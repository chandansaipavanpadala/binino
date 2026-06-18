.PHONY: install dev build server clean

install:
	npm install
	cd server && pip install -r requirements.txt

dev:
	npm run dev

build:
	npm run build

server:
	python -m uvicorn server.main:app --port 8000 --reload

clean:
	rm -rf dist node_modules server/__pycache__
