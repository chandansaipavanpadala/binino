.PHONY: install dev build server clean

install:
	npm install
	cd server && pip install -r requirements.txt

dev:
	npm run dev

build:
	npm run build

server:
	cd server && python -m uvicorn main:app --port 8000

clean:
	rm -rf dist node_modules server/__pycache__
