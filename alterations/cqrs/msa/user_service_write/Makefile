imageName=ghcr.io/quinten1333/thesisfair-user_service:cqrs-write

.phony: build push dev

build:
	docker build -t ${imageName} .

push:
	docker push ${imageName}

dev:
	docker compose up
