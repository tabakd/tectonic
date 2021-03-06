'use strict';

import { assert } from 'chai';

import Cache from '../../../src/cache';
import SourceDefinition from '../../../src/sources/definition';
import Provider from '../../../src/sources/provider';
import Query from '../../../src/query';
import {
  RETURNS_ITEM,
  RETURNS_LIST,
  RETURNS_ALL_FIELDS,
  DELETE,
} from '../../../src/consts';
// test stuff
import { User, Post } from '../../models';
import { createStore } from '../../manager';

describe('parsing cache data', () => {
  const cache = new Cache(createStore());

  describe('parseProvider', () => {

    it('parses a Return of RETURNS_ITEM correctly', () => {
      const provider = new Provider(User, RETURNS_ALL_FIELDS, RETURNS_ITEM);
      const apiResponse = {
        id: 1,
        name: 'foo',
        email: 'foo@bar.com'
      };
      const expires = new Date();

      const expected = {
        1: {
          data: apiResponse,
          cache: { expires }
        }
      };
      assert.deepEqual(
        cache.parseProvider(
          User.getItem(),
          provider,
          User,
          apiResponse,
          expires,
        ),
        expected
      );
    });

    it('parses a Return of RETURNS_LIST correctly', () => {
      const provider = new Provider(User, RETURNS_ALL_FIELDS, RETURNS_LIST);
      const apiResponse = [
        {
          id: 1,
          name: 'foo',
          email: 'foo@bar.com'
        },
        {
          id: 2,
          name: 'baz',
          email: 'baz@bar.com'
        },
      ];
      const expires = new Date();

      const expected = {
        1: {
          data: apiResponse[0],
          cache: { expires }
        },
        2: {
          data: apiResponse[1],
          cache: { expires }
        }
      };
      assert.deepEqual(
        cache.parseProvider(User.getList(), provider, User, apiResponse, expires),
        expected
      );
    });

    it('throws an error parsing a RETURNS_ITEM when an array is passed', () => {
      // This returns an item therefore the API response should be an object.
      const provider = new Provider(User, RETURNS_ALL_FIELDS, RETURNS_ITEM);
      const apiResponse = [{
        id: 1,
        name: 'foo',
        email: 'foo@bar.com'
      }];

      assert.throws(
        () => cache.parseProvider(User.getItem(), provider, User, apiResponse),
        `Data for returning an item must be an object`
      );
    })

    it('throws an error parsing a RETURNS_LIST when an object is passed', () => {
      // This returns an item therefore the API response should be an object.
      const provider = new Provider(User, RETURNS_ALL_FIELDS, RETURNS_LIST);
      const apiResponse = {
        id: 1,
        name: 'foo',
        email: 'foo@bar.com'
      };

      assert.throws(
        () => cache.parseProvider(User.getList(), provider, User, apiResponse),
        'Data for returning a list must be an array'
      );
    })

  });

  describe('parseApiData', () => {

    it('parses a polymorphic returns correctly', () => {
      const sd = new SourceDefinition({
        returns: {
          user: new Provider(User, RETURNS_ALL_FIELDS, RETURNS_ITEM),
          posts: new Provider(Post, RETURNS_ALL_FIELDS, RETURNS_LIST),
        },
        meta: {}
      });
      const apiResponse = {
        user: {
            id: 1,
            name: 'foo',
            email: 'foo@bar.com'
          },
        posts: [
          {
            id: 1,
            title: 'some post'
          },
          {
            id: 2,
            title: 'On the mechanics of economic development'
          },
        ]
      };
      const expires = new Date();

      const expected = {
        user: {
          1: {
            data: apiResponse.user,
            cache: { expires }
          }
        },
        post: {
          1: {
            data: apiResponse.posts[0],
            cache: { expires }
          },
          2: {
            data: apiResponse.posts[1],
            cache: { expires }
          },
        }
      };
      assert.deepEqual(
        cache.parseApiData(Post.getList(), sd, apiResponse, expires),
        expected
      );
    });

    it('sets expiry from sourceDef.cacheFor', () => {
      const sd = new SourceDefinition({
        returns: new Provider(User, RETURNS_ALL_FIELDS, RETURNS_ITEM),
        meta: {},
        cacheFor: 600,
      });
      const apiResponse = {
        id: 1,
        name: 'foo',
        email: 'foo@bar.com'
      };
      const expires = new Date();
      expires.setSeconds(600);

      const expected = {
        user: {
          1: {
            data: apiResponse,
            cache: { expires }
          }
        }
      };
      const actual = cache.parseApiData(User.getItem(), sd, apiResponse, expires);

      assert.closeTo(
        expected.user[1].cache.expires.getTime(),
        actual.user[1].cache.expires.getTime(),
        100,
        "Times are within 100ms as expected",
      );
      expected.user[1].cache.expires = actual.user[1].cache.expires;
      assert.deepEqual(expected, actual);
    });

    it('sets expiry from Model.cacheFor', () => {
      User.cacheFor = 900;
      const sd = new SourceDefinition({
        returns: new Provider(User, RETURNS_ALL_FIELDS, RETURNS_ITEM),
        meta: {},
      });
      const apiResponse = {
        id: 1,
        name: 'foo',
        email: 'foo@bar.com'
      };
      const expires = new Date();
      expires.setSeconds(900);
      const expected = {
        user: {
          1: {
            data: apiResponse,
            cache: { expires }
          }
        }
      };
      const actual = cache.parseApiData(User.getItem(), sd, apiResponse, expires);
      assert.closeTo(
        expected.user[1].cache.expires.getTime(),
        actual.user[1].cache.expires.getTime(),
        100,
        "Times are within 100ms as expected",
      );
      expected.user[1].cache.expires = actual.user[1].cache.expires;
      assert.deepEqual(expected, actual);
      User.cacheFor = undefined;
    });

    it('uses the lowest expiry from sourceDef.cacheFor and model.cacheFor', () => {
      const sd = new SourceDefinition({
        returns: new Provider(User, RETURNS_ALL_FIELDS, RETURNS_ITEM),
        meta: {},
        cacheFor: 600,
      });
      User.cacheFor = 900;
      const apiResponse = {
        id: 1,
        name: 'foo',
        email: 'foo@bar.com'
      };
      const expires = new Date();
      expires.setSeconds(600);
      const expected = {
        user: {
          1: {
            data: apiResponse,
            cache: { expires }
          }
        }
      };
      const actual = cache.parseApiData(User.getItem(), sd, apiResponse, expires);
      assert.closeTo(
        expected.user[1].cache.expires.getTime(),
        actual.user[1].cache.expires.getTime(),
        100,
        "Times are within 100ms as expected",
      );
      expected.user[1].cache.expires = actual.user[1].cache.expires;
      assert.deepEqual(expected, actual);
      User.cacheFor = undefined;
    });

    it('sets expiry from Model.cacheFor', () => {
      User.cacheFor = 900;
      const sd = new SourceDefinition({
        returns: new Provider(User, RETURNS_ALL_FIELDS, RETURNS_ITEM),
        meta: {},
      });
      const apiResponse = {
        id: 1,
        name: 'foo',
        email: 'foo@bar.com'
      };
      const expires = new Date();
      expires.setSeconds(900);
      const expected = {
        user: {
          1: {
            data: apiResponse,
            cache: { expires }
          }
        }
      };
      const actual = cache.parseApiData(User.getItem(), sd, apiResponse, expires);
      assert.closeTo(
        expected.user[1].cache.expires.getTime(),
        actual.user[1].cache.expires.getTime(),
        100,
        "Times are within 100ms as expected",
      );
      expected.user[1].cache.expires = actual.user[1].cache.expires;
      assert.deepEqual(expected, actual);
      User.cacheFor = undefined;
    });

  });

  describe('sets Query.returnedIds', () => {
    it('with a single non-polymorphic query and return', () => {
      const sd = new SourceDefinition({
        returns: new Provider(User, RETURNS_ALL_FIELDS, RETURNS_ITEM),
        meta: {}
      });
      const apiResponse = {
        id: 1,
        name: 'foo',
        email: 'foo@bar.com'
      };
      let query = User.getItem()
      assert.deepEqual(new Set(), query.returnedIds);
      cache.parseApiData(query, sd, apiResponse);
      assert.deepEqual(new Set(['1']), query.returnedIds);
    });

    it('with a polymorphic query and return', () => {
      const sd = new SourceDefinition({
        returns: {
          user: new Provider(User, RETURNS_ALL_FIELDS, RETURNS_ITEM),
          posts: new Provider(Post, RETURNS_ALL_FIELDS, RETURNS_LIST),
        },
        meta: {}
      });
      const apiResponse = {
        user: {
            id: 1,
            name: 'foo',
            email: 'foo@bar.com'
          },
        posts: [
          {
            id: 1,
            title: 'some post'
          },
          {
            id: 2,
            title: 'On the mechanics of economic development'
          },
        ]
      };

      // With a query for the user
      let query = User.getItem()
      assert.deepEqual(new Set(), query.returnedIds);
      cache.parseApiData(query, sd, apiResponse);
      assert.deepEqual(new Set(['1']), query.returnedIds);

      query = Post.getList()
      assert.deepEqual(new Set(), query.returnedIds);
      cache.parseApiData(query, sd, apiResponse);
      assert.deepEqual(new Set(['1', '2']), query.returnedIds);
    });
  });

  describe('processCachedModelMap', () => {
    xit('returns false with expired data', () => {
    });
    xit('returns false with deleted data', () => {
    });
    xit('returns data with correct cache information', () => {
    });
  });

  describe('getQueryData', () => {

    it('queries data correctly after a single basic GET', () => {
      const store = createStore();
      const cache = new Cache(store);
      const query = User.getItem({ id: 1 });
      const sd = new SourceDefinition({
        returns: new Provider(User, RETURNS_ALL_FIELDS, RETURNS_ITEM),
        meta: {}
      });
      const apiResponse = {
        id: 1,
        name: 'foo',
        email: 'foo@bar.com'
      };

      // Store data and set up state
      cache.storeQuery(query, sd, apiResponse);
      const state = store.getState().tectonic;

      assert.deepEqual(state.getIn(['queriesToIds', query.hash()]), new Set(['1']));

      const [data, ok] = cache.getQueryData(query, state);
      assert.isTrue(ok);
      assert.deepEqual(data, apiResponse);
    });

    describe('returns a list of data after GET of RETURNS_LIST', () => {
      const store = createStore();
      const cache = new Cache(store);
      const query = User.getList();
      const sd = new SourceDefinition({
        returns: new Provider(User, RETURNS_ALL_FIELDS, RETURNS_LIST),
        meta: {}
      });
      const apiResponse = [
        {
          id: 1,
          name: 'foo',
          email: 'foo@bar.com'
        },
        {
          id: 2,
          name: 'baz',
          email: 'baz@bar.com'
        }
      ];

      it('returns data after storing', () => {
        // Store data and set up state
        cache.storeQuery(query, sd, apiResponse);
        const state = store.getState().tectonic;
        assert.deepEqual(state.getIn(['queriesToIds', query.hash()]), new Set(['1', '2']));

        const [data, ok] = cache.getQueryData(query, state);
        assert.isTrue(ok);
        assert.deepEqual(data, apiResponse);
      });

      it('returns a partial list of data after a DELETE to one of the IDs', () => {
        const deleteDef = new SourceDefinition({
          queryType: DELETE,
          params: ['id'],
          meta: {}
        });
        const deleteQ = new Query({
          queryType: DELETE,
          model: User,
          modelId: 1,
          parmas: {id: 1},
        });
        cache.storeQuery(deleteQ, deleteDef, undefined);

        const state = store.getState().tectonic;
        const [data, ok] = cache.getQueryData(query, state);
        // Now that one of the data fields is missing the tuple should return
        // false to indicate that this needs refetching. Note that the manager
        // ignores this, so `data` returned from the cache is still passed to
        // components. This is purely used during resolving, ensuring the same
        // query will refetch in the future.
        assert.isFalse(ok);
        assert.deepEqual(data, [apiResponse[1]]);
      }); 
    });

    it('returns an empty array after a 200 API request to a List endpoint which returns nothing', () => {
      const store = createStore();
      const cache = new Cache(store);
      const query = User.getList();
      const sd = new SourceDefinition({
        returns: new Provider(User, RETURNS_ALL_FIELDS, RETURNS_LIST),
        meta: {}
      });
      const apiResponse = [];

      cache.storeQuery(query, sd, apiResponse);
      const state = store.getState().tectonic;
      assert.deepEqual(state.getIn(['queriesToIds', query.hash()]), new Set([]));

      const [data, ok] = cache.getQueryData(query, state);
      assert.isTrue(ok);
      assert.deepEqual(data, []);
    });

  });

});
