start:
	minikube start --driver=kvm2 --memory=6g --disk-size=50g --cpus=8
	kubectl apply -f "https://github.com/rabbitmq/cluster-operator/releases/latest/download/cluster-operator.yml"

stop:
	minikube stop

delete:
	minikube delete

rabbitmqDashboard:
	kubectl port-forward "service/rabbitmq" 15672

traefikDashboard:
	kubectl port-forward $$(kubectl get pods --selector "app.kubernetes.io/name=traefik" --output=name) 9000:9000

open:
	minikube service service-api-gateway --url


update:
	./scripts/updateContainerRepo.sh .

up:
	cd kubernetes && ./build.sh
	kubectl apply -f ./kubernetes/build/

init:
	kubectl apply -f kubernetes/dbInit.yaml

down:
	kubectl delete -f ./kubernetes/build/
	kubectl delete -f kubernetes/dbInit.yaml
