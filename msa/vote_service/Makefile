imageName=ghcr.io/quinten1333/thesisfair-vote_service:base

.phony: build push dev

build:
	docker build -t ${imageName} .

push:
	docker push ${imageName}

dev:
	docker compose up
