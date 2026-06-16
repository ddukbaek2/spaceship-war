#!/usr/bin/env node
//==============================================================================
// 개발 테스트용 정적 파일 서버.
// 외부 의존성 없이 Node 내장 http 모듈만 사용한다. (esbuild / Live Server 불필요)
// launcher.html -> launcher.js -> src/main.js -> libs/vanilla.js 모듈 체인을
// 그대로 정적 서빙하므로, F5 한 번으로 브라우저에서 게임을 실행할 수 있다.
//
// 사용법:
//   node tools/devserver.cjs [port] [host]
//==============================================================================
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");


const projectRoot = path.resolve(__dirname, "..");
const defaultPort = 6001;
const defaultHost = "127.0.0.1";
const defaultDocument = "launcher.html";


//==============================================================================
// 확장자별 Content-Type 매핑.
//==============================================================================
const contentTypes = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".cjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".woff": "font/woff",
	".ttf": "font/ttf",
	".webm": "audio/webm",
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
	".map": "application/json; charset=utf-8",
};


//==============================================================================
// 확장자에 해당하는 Content-Type 반환.
//==============================================================================
function getContentType(extension) {
	const lowerCaseExtension = extension.toLowerCase();
	const contentType = contentTypes[lowerCaseExtension];
	if (contentType) {
		return contentType;
	}
	return "application/octet-stream";
}


//==============================================================================
// 응답 전송 (단순 텍스트).
//==============================================================================
function sendStatus(response, statusCode, message) {
	response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
	response.end(message);
}


//==============================================================================
// 요청 처리.
//==============================================================================
function handleRequest(request, response) {
	const requestUrl = new URL(request.url, `http://${request.headers.host}`);
	let pathName = decodeURIComponent(requestUrl.pathname);

	// 루트 요청은 기본 문서로 대체.
	if (pathName === "/") {
		pathName = `/${defaultDocument}`;
	}

	// 디렉토리 트래버설 방지를 위해 정규화 후 루트 내부인지 검사.
	const requestedPath = path.normalize(path.join(projectRoot, pathName));
	if (requestedPath !== projectRoot && !requestedPath.startsWith(projectRoot + path.sep)) {
		sendStatus(response, 403, "403 Forbidden");
		return;
	}

	fs.stat(requestedPath, (statError, stats) => {
		if (statError) {
			sendStatus(response, 404, "404 Not Found");
			return;
		}

		// 디렉토리 요청은 내부 index.html 로 대체.
		let filePath = requestedPath;
		if (stats.isDirectory()) {
			filePath = path.join(requestedPath, "index.html");
			if (!fs.existsSync(filePath)) {
				sendStatus(response, 404, "404 Not Found");
				return;
			}
		}

		const fileExtension = path.extname(filePath);
		const contentType = getContentType(fileExtension);
		response.writeHead(200, {
			"Content-Type": contentType,
			"Cache-Control": "no-cache",
		});

		const readStream = fs.createReadStream(filePath);
		readStream.on("error", () => {
			sendStatus(response, 500, "500 Internal Server Error");
		});
		readStream.pipe(response);
	});
}


//==============================================================================
// 메인.
//==============================================================================
function main() {
	const args = process.argv.slice(2);
	const port = args[0] ? Number(args[0]) : defaultPort;
	const host = args[1] ? args[1] : defaultHost;

	const server = http.createServer(handleRequest);

	server.on("error", (error) => {
		if (error.code === "EADDRINUSE") {
			const reuseAddress = `http://${host}:${port}/${defaultDocument}`;
			console.log(`[devserver] 포트 ${port} 에 이미 서버가 있어 재사용합니다 - ${reuseAddress}`);
			// preLaunchTask 가 준비 완료로 간주하도록 프로세스를 유지한다.
			setInterval(() => {}, 1 << 30);
			return;
		}
		console.error(`[devserver] 서버 오류:`, error);
		process.exit(1);
	});

	server.listen(port, host, () => {
		const address = `http://${host}:${port}/${defaultDocument}`;
		console.log(`[devserver] 정적 서버를 시작했습니다: ${projectRoot}`);
		console.log(`[devserver] 준비 완료 - ${address}`);
	});
}


main();
