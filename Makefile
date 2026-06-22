.PHONY: docker-up docker-down docker-test-up docker-test-down

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-test-up:
	docker compose -f docker-compose.test.yml up -d

docker-test-down:
	docker compose -f docker-compose.test.yml down
