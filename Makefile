all: docbuilder docs

docbuilder:
	docker run --rm -v $(shell pwd -P)/docs-builder:/go/src/docs \
	-v $(shell pwd -P)/docs-builder/bin:/go/bin \
	golang:1.7.4-alpine \
	go install docs

docs: clean
	docker run --rm -v $(shell pwd -P):/data alpine:3.4 /data/docs-builder/bin/docs

clean:
	rm -f docs/*.html

.PHONY: docs