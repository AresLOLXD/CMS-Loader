## [1.0.3](https://github.com/AresLOLXD/CMS-Loader/compare/v1.0.2...v1.0.3) (2026-05-18)


### Bug Fixes

* mark session modified on csrf-token route to ensure session cookie is sent ([05c5db7](https://github.com/AresLOLXD/CMS-Loader/commit/05c5db74a92a523b3724a58f0d7f326e1b5b7b2a))

## [1.0.2](https://github.com/AresLOLXD/CMS-Loader/compare/v1.0.1...v1.0.2) (2026-05-18)


### Bug Fixes

* save session before generating CSRF token to ensure consistent sessionID ([ad727a5](https://github.com/AresLOLXD/CMS-Loader/commit/ad727a593f7f75881070dfcfd4731e939379c2c5))

## [1.0.1](https://github.com/AresLOLXD/CMS-Loader/compare/v1.0.0...v1.0.1) (2026-05-18)


### Bug Fixes

* prevent semantic-release pre-push loop on release commits ([4a7af7b](https://github.com/AresLOLXD/CMS-Loader/commit/4a7af7b6ee7dce7c73fc685fa700e6e689477c36))

## [1.0.1](https://github.com/AresLOLXD/CMS-Loader/compare/v1.0.0...v1.0.1) (2026-05-18)


### Bug Fixes

* prevent semantic-release pre-push loop on release commits ([4a7af7b](https://github.com/AresLOLXD/CMS-Loader/commit/4a7af7b6ee7dce7c73fc685fa700e6e689477c36))

# 1.0.0 (2026-05-18)


### Bug Fixes

* add job ownership check, double-submit guard, stale job cleanup on upload ([3ad536b](https://github.com/AresLOLXD/CMS-Loader/commit/3ad536b8bc45234595128ffb9f06d04c8ea07e54))
* correct middleware order and style in index.ts ([e4fb8ba](https://github.com/AresLOLXD/CMS-Loader/commit/e4fb8babab258410e53a6648dfc38e7583399f85))
* exclude /api/* from SPA catch-all, add sendFile error callback ([f07f412](https://github.com/AresLOLXD/CMS-Loader/commit/f07f41253dc36f729b30f97a2e40c72548341c90))
* guard SSE onerror with completed flag, delay redirect, safe progress JSON parse ([e6584b5](https://github.com/AresLOLXD/CMS-Loader/commit/e6584b5ce26973a20233462eb036c984b42ce9cc))
* log unexpected job errors, fix error message to show actual username ([9fbdc47](https://github.com/AresLOLXD/CMS-Loader/commit/9fbdc475cc432fd772a7c5676c24976e88f177cf))
* move jobId null-guard from render to useEffect in ProcessingStep ([85466c4](https://github.com/AresLOLXD/CMS-Loader/commit/85466c40551c658f3656b292133256691a5433f5))
* move logout route from /login/logout to /logout ([c6a3d1a](https://github.com/AresLOLXD/CMS-Loader/commit/c6a3d1aac02862062b8b66bd3fa60daecf3550fb))
* move tsx to dependencies, add jobId null-guard and SSE closed flag in ProcessingStep ([b8b5a36](https://github.com/AresLOLXD/CMS-Loader/commit/b8b5a361f8722f0ca8be0e76294fe9576032452b))
* reject executeProcess only on non-zero exit, attach stderr to error ([97bfc45](https://github.com/AresLOLXD/CMS-Loader/commit/97bfc452ffe79a6bc10faae35c86ce3f56f54b10))
* resolve TypeScript error in addParticipation test (void | Error union) ([39e2dca](https://github.com/AresLOLXD/CMS-Loader/commit/39e2dcaddc6fc876402f81b30159ee8c971bd83b))
* return 400 for rejected file types in analyzeCSV; test: add integration tests ([a77772f](https://github.com/AresLOLXD/CMS-Loader/commit/a77772f3926da0f5fb89d7ae4428088f1cd9ba45))
* typed route params, add SSE heartbeat and TTL-eviction terminal event ([7e4ca06](https://github.com/AresLOLXD/CMS-Loader/commit/7e4ca06544d0a3e27942e5ce0e9e1e665faaa4d1))


### Features

* add auth controller and login view ([3ad54e9](https://github.com/AresLOLXD/CMS-Loader/commit/3ad54e9f7dbd8ca08b28510d15551be001e35fc3))
* add buildCmsCommand utility, remove hardcoded CMS CLI path from controllers ([fa28af3](https://github.com/AresLOLXD/CMS-Loader/commit/fa28af37e2b8a016bc93a872996c55d9e371cf79))
* add csrf-csrf module ([761838b](https://github.com/AresLOLXD/CMS-Loader/commit/761838bf1d6154226cceac812ae3eabdd3ad1181))
* add DoneStep with wizard reset and logout ([065cabb](https://github.com/AresLOLXD/CMS-Loader/commit/065cabb17d2945d1f391cd60182f3b9e3890d153))
* add dotenv, boot validation, remove hardcoded session secret ([a4d3e69](https://github.com/AresLOLXD/CMS-Loader/commit/a4d3e690091008c1e9f0a07f9f7ee1893730c895))
* add GET /api/me, make csrf-token public, convert login to JSON API, remove views ([d1c097b](https://github.com/AresLOLXD/CMS-Loader/commit/d1c097b91eabdb515e6ce13d41cae6cc81a0e844))
* add helmet, cookie-parser, and csrf-csrf middleware ([224d6e6](https://github.com/AresLOLXD/CMS-Loader/commit/224d6e65fd982049efab5d0769a3d33064208aa9))
* add in-memory JobStore singleton with TTL cleanup ([5482454](https://github.com/AresLOLXD/CMS-Loader/commit/5482454f1644113c67f69f4d34cc3f634cfb1c46))
* add jobs controller (SSE progress + result download), mount /jobs routes ([15f39bf](https://github.com/AresLOLXD/CMS-Loader/commit/15f39bf187464c48e03132b90eecd4a3344f4299))
* add Login component with CSRF handling ([59e7c31](https://github.com/AresLOLXD/CMS-Loader/commit/59e7c31fcddf85a884a22ffc2de422a29f21fe18))
* add MappingStep with field assignment and validation ([a39f659](https://github.com/AresLOLXD/CMS-Loader/commit/a39f6598877e8281195de8f69105d51d8eb36fce))
* add parseBoolFlag utility ([f530b79](https://github.com/AresLOLXD/CMS-Loader/commit/f530b7933e0b60a8fe2fa12818ff2d522a3eef9b))
* add Preact signals, field config, and App shell with component stubs ([2b7770c](https://github.com/AresLOLXD/CMS-Loader/commit/2b7770c820d01f5fba2c806302d1c4f69e529489))
* add ProcessingStep with SSE progress and blob download ([cc5c4c6](https://github.com/AresLOLXD/CMS-Loader/commit/cc5c4c6725394ee3a3fab71243742e19c6b50905))
* add processRecords shared helper ([57b3527](https://github.com/AresLOLXD/CMS-Loader/commit/57b3527a59223c8bb78f7b45f5adee266ca7bee6))
* add progress bar UI to column selection templates ([1b13f6f](https://github.com/AresLOLXD/CMS-Loader/commit/1b13f6fbb557328a58d12205d01d543e6845c762))
* add rate limiting to upload, processing, and login endpoints ([ccd4195](https://github.com/AresLOLXD/CMS-Loader/commit/ccd4195ae7c4e42b659b8d34cb0b964c0676b0bd))
* add requireAuth middleware ([adda4d3](https://github.com/AresLOLXD/CMS-Loader/commit/adda4d3ac64f85ef28e5396fbcbd1fa8396a27aa))
* add UploadStep with CSV analysis and CSRF retry ([75b8937](https://github.com/AresLOLXD/CMS-Loader/commit/75b89376e29285c0808fdc68759a9639603e7561))
* async job processing with p-limit; controllers return jobId immediately ([7ace925](https://github.com/AresLOLXD/CMS-Loader/commit/7ace925677822b3dc933110ed6512b0cd321797b))
* mount auth routes and requireAuth guard ([4c76778](https://github.com/AresLOLXD/CMS-Loader/commit/4c76778b987524f7200bcf8181d2b4cd56b08007))
* pass CSRF tokens to EJS views ([7243800](https://github.com/AresLOLXD/CMS-Loader/commit/724380007f85e14d4d8c4cff5297db867d7b126a))
* replace __dirname with import.meta.dirname, serve Preact SPA from client/dist ([66f84f2](https://github.com/AresLOLXD/CMS-Loader/commit/66f84f266c6edb43cf5d16a3a4cce617ee49019c))
* replace blob-wait pattern with SSE progress stream in submitSelectionForm ([d515449](https://github.com/AresLOLXD/CMS-Loader/commit/d515449afa16081b565506f3d7bd3328459502d0))
* send CSRF tokens in frontend fetch requests ([34fbbe8](https://github.com/AresLOLXD/CMS-Loader/commit/34fbbe8f95deb3fe3c7070b2ce6c2711fd4fc5c8))
* store CSV records in JobStore, update SessionData, start TTL cleanup ([c7acb4d](https://github.com/AresLOLXD/CMS-Loader/commit/c7acb4d1b2ab5cd5c1b141c7d339408cfe81b83c))

# 1.0.0 (2026-05-18)


### Bug Fixes

* add job ownership check, double-submit guard, stale job cleanup on upload ([3ad536b](https://github.com/AresLOLXD/CMS-Loader/commit/3ad536b8bc45234595128ffb9f06d04c8ea07e54))
* correct middleware order and style in index.ts ([e4fb8ba](https://github.com/AresLOLXD/CMS-Loader/commit/e4fb8babab258410e53a6648dfc38e7583399f85))
* exclude /api/* from SPA catch-all, add sendFile error callback ([f07f412](https://github.com/AresLOLXD/CMS-Loader/commit/f07f41253dc36f729b30f97a2e40c72548341c90))
* guard SSE onerror with completed flag, delay redirect, safe progress JSON parse ([e6584b5](https://github.com/AresLOLXD/CMS-Loader/commit/e6584b5ce26973a20233462eb036c984b42ce9cc))
* log unexpected job errors, fix error message to show actual username ([9fbdc47](https://github.com/AresLOLXD/CMS-Loader/commit/9fbdc475cc432fd772a7c5676c24976e88f177cf))
* move jobId null-guard from render to useEffect in ProcessingStep ([85466c4](https://github.com/AresLOLXD/CMS-Loader/commit/85466c40551c658f3656b292133256691a5433f5))
* move logout route from /login/logout to /logout ([c6a3d1a](https://github.com/AresLOLXD/CMS-Loader/commit/c6a3d1aac02862062b8b66bd3fa60daecf3550fb))
* move tsx to dependencies, add jobId null-guard and SSE closed flag in ProcessingStep ([b8b5a36](https://github.com/AresLOLXD/CMS-Loader/commit/b8b5a361f8722f0ca8be0e76294fe9576032452b))
* reject executeProcess only on non-zero exit, attach stderr to error ([97bfc45](https://github.com/AresLOLXD/CMS-Loader/commit/97bfc452ffe79a6bc10faae35c86ce3f56f54b10))
* resolve TypeScript error in addParticipation test (void | Error union) ([39e2dca](https://github.com/AresLOLXD/CMS-Loader/commit/39e2dcaddc6fc876402f81b30159ee8c971bd83b))
* return 400 for rejected file types in analyzeCSV; test: add integration tests ([a77772f](https://github.com/AresLOLXD/CMS-Loader/commit/a77772f3926da0f5fb89d7ae4428088f1cd9ba45))
* typed route params, add SSE heartbeat and TTL-eviction terminal event ([7e4ca06](https://github.com/AresLOLXD/CMS-Loader/commit/7e4ca06544d0a3e27942e5ce0e9e1e665faaa4d1))


### Features

* add auth controller and login view ([3ad54e9](https://github.com/AresLOLXD/CMS-Loader/commit/3ad54e9f7dbd8ca08b28510d15551be001e35fc3))
* add buildCmsCommand utility, remove hardcoded CMS CLI path from controllers ([fa28af3](https://github.com/AresLOLXD/CMS-Loader/commit/fa28af37e2b8a016bc93a872996c55d9e371cf79))
* add csrf-csrf module ([761838b](https://github.com/AresLOLXD/CMS-Loader/commit/761838bf1d6154226cceac812ae3eabdd3ad1181))
* add DoneStep with wizard reset and logout ([065cabb](https://github.com/AresLOLXD/CMS-Loader/commit/065cabb17d2945d1f391cd60182f3b9e3890d153))
* add dotenv, boot validation, remove hardcoded session secret ([a4d3e69](https://github.com/AresLOLXD/CMS-Loader/commit/a4d3e690091008c1e9f0a07f9f7ee1893730c895))
* add GET /api/me, make csrf-token public, convert login to JSON API, remove views ([d1c097b](https://github.com/AresLOLXD/CMS-Loader/commit/d1c097b91eabdb515e6ce13d41cae6cc81a0e844))
* add helmet, cookie-parser, and csrf-csrf middleware ([224d6e6](https://github.com/AresLOLXD/CMS-Loader/commit/224d6e65fd982049efab5d0769a3d33064208aa9))
* add in-memory JobStore singleton with TTL cleanup ([5482454](https://github.com/AresLOLXD/CMS-Loader/commit/5482454f1644113c67f69f4d34cc3f634cfb1c46))
* add jobs controller (SSE progress + result download), mount /jobs routes ([15f39bf](https://github.com/AresLOLXD/CMS-Loader/commit/15f39bf187464c48e03132b90eecd4a3344f4299))
* add Login component with CSRF handling ([59e7c31](https://github.com/AresLOLXD/CMS-Loader/commit/59e7c31fcddf85a884a22ffc2de422a29f21fe18))
* add MappingStep with field assignment and validation ([a39f659](https://github.com/AresLOLXD/CMS-Loader/commit/a39f6598877e8281195de8f69105d51d8eb36fce))
* add parseBoolFlag utility ([f530b79](https://github.com/AresLOLXD/CMS-Loader/commit/f530b7933e0b60a8fe2fa12818ff2d522a3eef9b))
* add Preact signals, field config, and App shell with component stubs ([2b7770c](https://github.com/AresLOLXD/CMS-Loader/commit/2b7770c820d01f5fba2c806302d1c4f69e529489))
* add ProcessingStep with SSE progress and blob download ([cc5c4c6](https://github.com/AresLOLXD/CMS-Loader/commit/cc5c4c6725394ee3a3fab71243742e19c6b50905))
* add processRecords shared helper ([57b3527](https://github.com/AresLOLXD/CMS-Loader/commit/57b3527a59223c8bb78f7b45f5adee266ca7bee6))
* add progress bar UI to column selection templates ([1b13f6f](https://github.com/AresLOLXD/CMS-Loader/commit/1b13f6fbb557328a58d12205d01d543e6845c762))
* add rate limiting to upload, processing, and login endpoints ([ccd4195](https://github.com/AresLOLXD/CMS-Loader/commit/ccd4195ae7c4e42b659b8d34cb0b964c0676b0bd))
* add requireAuth middleware ([adda4d3](https://github.com/AresLOLXD/CMS-Loader/commit/adda4d3ac64f85ef28e5396fbcbd1fa8396a27aa))
* add UploadStep with CSV analysis and CSRF retry ([75b8937](https://github.com/AresLOLXD/CMS-Loader/commit/75b89376e29285c0808fdc68759a9639603e7561))
* async job processing with p-limit; controllers return jobId immediately ([7ace925](https://github.com/AresLOLXD/CMS-Loader/commit/7ace925677822b3dc933110ed6512b0cd321797b))
* mount auth routes and requireAuth guard ([4c76778](https://github.com/AresLOLXD/CMS-Loader/commit/4c76778b987524f7200bcf8181d2b4cd56b08007))
* pass CSRF tokens to EJS views ([7243800](https://github.com/AresLOLXD/CMS-Loader/commit/724380007f85e14d4d8c4cff5297db867d7b126a))
* replace __dirname with import.meta.dirname, serve Preact SPA from client/dist ([66f84f2](https://github.com/AresLOLXD/CMS-Loader/commit/66f84f266c6edb43cf5d16a3a4cce617ee49019c))
* replace blob-wait pattern with SSE progress stream in submitSelectionForm ([d515449](https://github.com/AresLOLXD/CMS-Loader/commit/d515449afa16081b565506f3d7bd3328459502d0))
* send CSRF tokens in frontend fetch requests ([34fbbe8](https://github.com/AresLOLXD/CMS-Loader/commit/34fbbe8f95deb3fe3c7070b2ce6c2711fd4fc5c8))
* store CSV records in JobStore, update SessionData, start TTL cleanup ([c7acb4d](https://github.com/AresLOLXD/CMS-Loader/commit/c7acb4d1b2ab5cd5c1b141c7d339408cfe81b83c))

# 1.0.0 (2026-05-18)


### Bug Fixes

* add job ownership check, double-submit guard, stale job cleanup on upload ([3ad536b](https://github.com/AresLOLXD/CMS-Loader/commit/3ad536b8bc45234595128ffb9f06d04c8ea07e54))
* correct middleware order and style in index.ts ([e4fb8ba](https://github.com/AresLOLXD/CMS-Loader/commit/e4fb8babab258410e53a6648dfc38e7583399f85))
* exclude /api/* from SPA catch-all, add sendFile error callback ([f07f412](https://github.com/AresLOLXD/CMS-Loader/commit/f07f41253dc36f729b30f97a2e40c72548341c90))
* guard SSE onerror with completed flag, delay redirect, safe progress JSON parse ([e6584b5](https://github.com/AresLOLXD/CMS-Loader/commit/e6584b5ce26973a20233462eb036c984b42ce9cc))
* log unexpected job errors, fix error message to show actual username ([9fbdc47](https://github.com/AresLOLXD/CMS-Loader/commit/9fbdc475cc432fd772a7c5676c24976e88f177cf))
* move jobId null-guard from render to useEffect in ProcessingStep ([85466c4](https://github.com/AresLOLXD/CMS-Loader/commit/85466c40551c658f3656b292133256691a5433f5))
* move logout route from /login/logout to /logout ([c6a3d1a](https://github.com/AresLOLXD/CMS-Loader/commit/c6a3d1aac02862062b8b66bd3fa60daecf3550fb))
* move tsx to dependencies, add jobId null-guard and SSE closed flag in ProcessingStep ([b8b5a36](https://github.com/AresLOLXD/CMS-Loader/commit/b8b5a361f8722f0ca8be0e76294fe9576032452b))
* reject executeProcess only on non-zero exit, attach stderr to error ([97bfc45](https://github.com/AresLOLXD/CMS-Loader/commit/97bfc452ffe79a6bc10faae35c86ce3f56f54b10))
* resolve TypeScript error in addParticipation test (void | Error union) ([39e2dca](https://github.com/AresLOLXD/CMS-Loader/commit/39e2dcaddc6fc876402f81b30159ee8c971bd83b))
* return 400 for rejected file types in analyzeCSV; test: add integration tests ([a77772f](https://github.com/AresLOLXD/CMS-Loader/commit/a77772f3926da0f5fb89d7ae4428088f1cd9ba45))
* typed route params, add SSE heartbeat and TTL-eviction terminal event ([7e4ca06](https://github.com/AresLOLXD/CMS-Loader/commit/7e4ca06544d0a3e27942e5ce0e9e1e665faaa4d1))


### Features

* add auth controller and login view ([3ad54e9](https://github.com/AresLOLXD/CMS-Loader/commit/3ad54e9f7dbd8ca08b28510d15551be001e35fc3))
* add buildCmsCommand utility, remove hardcoded CMS CLI path from controllers ([fa28af3](https://github.com/AresLOLXD/CMS-Loader/commit/fa28af37e2b8a016bc93a872996c55d9e371cf79))
* add csrf-csrf module ([761838b](https://github.com/AresLOLXD/CMS-Loader/commit/761838bf1d6154226cceac812ae3eabdd3ad1181))
* add DoneStep with wizard reset and logout ([065cabb](https://github.com/AresLOLXD/CMS-Loader/commit/065cabb17d2945d1f391cd60182f3b9e3890d153))
* add dotenv, boot validation, remove hardcoded session secret ([a4d3e69](https://github.com/AresLOLXD/CMS-Loader/commit/a4d3e690091008c1e9f0a07f9f7ee1893730c895))
* add GET /api/me, make csrf-token public, convert login to JSON API, remove views ([d1c097b](https://github.com/AresLOLXD/CMS-Loader/commit/d1c097b91eabdb515e6ce13d41cae6cc81a0e844))
* add helmet, cookie-parser, and csrf-csrf middleware ([224d6e6](https://github.com/AresLOLXD/CMS-Loader/commit/224d6e65fd982049efab5d0769a3d33064208aa9))
* add in-memory JobStore singleton with TTL cleanup ([5482454](https://github.com/AresLOLXD/CMS-Loader/commit/5482454f1644113c67f69f4d34cc3f634cfb1c46))
* add jobs controller (SSE progress + result download), mount /jobs routes ([15f39bf](https://github.com/AresLOLXD/CMS-Loader/commit/15f39bf187464c48e03132b90eecd4a3344f4299))
* add Login component with CSRF handling ([59e7c31](https://github.com/AresLOLXD/CMS-Loader/commit/59e7c31fcddf85a884a22ffc2de422a29f21fe18))
* add MappingStep with field assignment and validation ([a39f659](https://github.com/AresLOLXD/CMS-Loader/commit/a39f6598877e8281195de8f69105d51d8eb36fce))
* add parseBoolFlag utility ([f530b79](https://github.com/AresLOLXD/CMS-Loader/commit/f530b7933e0b60a8fe2fa12818ff2d522a3eef9b))
* add Preact signals, field config, and App shell with component stubs ([2b7770c](https://github.com/AresLOLXD/CMS-Loader/commit/2b7770c820d01f5fba2c806302d1c4f69e529489))
* add ProcessingStep with SSE progress and blob download ([cc5c4c6](https://github.com/AresLOLXD/CMS-Loader/commit/cc5c4c6725394ee3a3fab71243742e19c6b50905))
* add processRecords shared helper ([57b3527](https://github.com/AresLOLXD/CMS-Loader/commit/57b3527a59223c8bb78f7b45f5adee266ca7bee6))
* add progress bar UI to column selection templates ([1b13f6f](https://github.com/AresLOLXD/CMS-Loader/commit/1b13f6fbb557328a58d12205d01d543e6845c762))
* add rate limiting to upload, processing, and login endpoints ([ccd4195](https://github.com/AresLOLXD/CMS-Loader/commit/ccd4195ae7c4e42b659b8d34cb0b964c0676b0bd))
* add requireAuth middleware ([adda4d3](https://github.com/AresLOLXD/CMS-Loader/commit/adda4d3ac64f85ef28e5396fbcbd1fa8396a27aa))
* add UploadStep with CSV analysis and CSRF retry ([75b8937](https://github.com/AresLOLXD/CMS-Loader/commit/75b89376e29285c0808fdc68759a9639603e7561))
* async job processing with p-limit; controllers return jobId immediately ([7ace925](https://github.com/AresLOLXD/CMS-Loader/commit/7ace925677822b3dc933110ed6512b0cd321797b))
* mount auth routes and requireAuth guard ([4c76778](https://github.com/AresLOLXD/CMS-Loader/commit/4c76778b987524f7200bcf8181d2b4cd56b08007))
* pass CSRF tokens to EJS views ([7243800](https://github.com/AresLOLXD/CMS-Loader/commit/724380007f85e14d4d8c4cff5297db867d7b126a))
* replace __dirname with import.meta.dirname, serve Preact SPA from client/dist ([66f84f2](https://github.com/AresLOLXD/CMS-Loader/commit/66f84f266c6edb43cf5d16a3a4cce617ee49019c))
* replace blob-wait pattern with SSE progress stream in submitSelectionForm ([d515449](https://github.com/AresLOLXD/CMS-Loader/commit/d515449afa16081b565506f3d7bd3328459502d0))
* send CSRF tokens in frontend fetch requests ([34fbbe8](https://github.com/AresLOLXD/CMS-Loader/commit/34fbbe8f95deb3fe3c7070b2ce6c2711fd4fc5c8))
* store CSV records in JobStore, update SessionData, start TTL cleanup ([c7acb4d](https://github.com/AresLOLXD/CMS-Loader/commit/c7acb4d1b2ab5cd5c1b141c7d339408cfe81b83c))
