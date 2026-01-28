module.exports=[70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},24361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},63021,(e,t,r)=>{t.exports=e.x("@prisma/client-2c3a283f134fdcb6",()=>require("@prisma/client-2c3a283f134fdcb6"))},9287,e=>{"use strict";var t=e.i(63021);let r=e.g.prisma||new t.PrismaClient({log:["error"]});e.s(["prisma",0,r])},54799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},92509,(e,t,r)=>{t.exports=e.x("url",()=>require("url"))},21517,(e,t,r)=>{t.exports=e.x("http",()=>require("http"))},49719,(e,t,r)=>{t.exports=e.x("assert",()=>require("assert"))},874,(e,t,r)=>{t.exports=e.x("buffer",()=>require("buffer"))},6461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},24836,(e,t,r)=>{t.exports=e.x("https",()=>require("https"))},27699,(e,t,r)=>{t.exports=e.x("events",()=>require("events"))},84517,e=>{"use strict";var t=e.i(74955);function r(e,r,a,n){let s=`${e}${r}${a}${n}`;return t.default.SHA256(s).toString()}function a(e,t,a){return t.map((t,n)=>r(e,n,t,a))}function n(e,r){let a=JSON.stringify(e)+r;return t.default.SHA256(a).toString()}function s(e,t,r){return n(e,t)===r}function i(){return t.default.lib.WordArray.random(32).toString()}function o(){return i()}function l(e,t,a,n,s){return r(e,t,a,n)===s}function u(e,r){if(!r||r.length<32)throw Error("Encryption key must be at least 32 characters");return t.default.AES.encrypt(e,r).toString()}function d(e,r){if(!r||r.length<32)throw Error("Encryption key must be at least 32 characters");try{let a=t.default.AES.decrypt(e,r).toString(t.default.enc.Utf8);if(!a)throw Error("Decryption failed - invalid key or corrupted data");return a}catch(e){throw Error("Failed to decrypt mnemonic: "+(e instanceof Error?e.message:"Unknown error"))}}function c(e,r){if(!r||r.length<32)throw Error("Encryption key must be at least 32 characters");let a=JSON.stringify(e);return t.default.AES.encrypt(a,r).toString()}function p(e,r){if(!r||r.length<32)throw Error("Encryption key must be at least 32 characters");try{let a=t.default.AES.decrypt(e,r).toString(t.default.enc.Utf8);if(!a)throw Error("Decryption failed - invalid key or corrupted data");return JSON.parse(a)}catch(e){throw Error("Failed to decrypt quiz reveal data: "+(e instanceof Error?e.message:"Unknown error"))}}function h(e,r){if(!r||r.length<32)throw Error("Encryption key must be at least 32 characters");let a=JSON.stringify(e);return t.default.AES.encrypt(a,r).toString()}function f(e,r){if(!r||r.length<32)throw Error("Encryption key must be at least 32 characters");try{let a=t.default.AES.decrypt(e,r).toString(t.default.enc.Utf8);if(!a)throw Error("Decryption failed - invalid key or corrupted data");return JSON.parse(a)}catch(e){throw Error("Failed to decrypt attempt reveal data: "+(e instanceof Error?e.message:"Unknown error"))}}e.s(["decryptAttemptRevealData",()=>f,"decryptMnemonic",()=>d,"decryptQuizRevealData",()=>p,"encryptAttemptRevealData",()=>h,"encryptMnemonic",()=>u,"encryptQuizRevealData",()=>c,"generateNonce",()=>o,"generateSalt",()=>i,"hashAnswer",()=>r,"hashAnswers",()=>a,"hashCommitment",()=>n,"verifyAnswerHash",()=>l,"verifyCommitment",()=>s])},1379,e=>{"use strict";var t=e.i(84517),r=e.i(9287);async function a(){let{generateMnemonic:t}=await e.A(50767);return t()}async function n(a){let n=await r.prisma.user.findUnique({where:{id:a}});if(!n)throw Error("User not found");if(!n.encryptedMnemonic)throw Error("User has no custodial wallet");let s=process.env.WALLET_ENCRYPTION_KEY;if(!s)throw Error("WALLET_ENCRYPTION_KEY not configured");let i=(0,t.decryptMnemonic)(n.encryptedMnemonic,s),{Computer:o}=await e.A(47085);return new o({chain:"LTC",network:"regtest",url:"https://rltc.node.bitcoincomputer.io",mnemonic:i})}async function s(e){let t=await n(e),{balance:a}=await t.getBalance();return await r.prisma.user.update({where:{id:e},data:{walletBalance:a,lastBalanceCheck:new Date}}),a}async function i(e,t){let r=await n(e),a=r.getAddress();return console.log(`💰 Funding user ${e} with faucet to ${a}`),await r.faucet(1e7),console.log(`✅ Faucet funded user wallet`),await s(e),"faucet"}async function o(n){let s=process.env.WALLET_ENCRYPTION_KEY;if(!s)throw Error("WALLET_ENCRYPTION_KEY not configured");let o=await a();console.log(`🔑 Generated wallet for user ${n}`);let l=(0,t.encryptMnemonic)(o,s),{Computer:u}=await e.A(47085),d=new u({chain:"LTC",network:"regtest",url:"https://rltc.node.bitcoincomputer.io",mnemonic:o}),c=d.getAddress(),p=d.getPublicKey();await r.prisma.user.update({where:{id:n},data:{encryptedMnemonic:l,address:c,publicKey:p,walletType:"CUSTODIAL",walletBalance:BigInt(0)}}),console.log(`✅ Wallet initialized for user ${n}: ${c}`);try{await i(n,5e5),console.log(`💰 Funded user ${n} with 500k sats starter amount`)}catch(e){console.error("⚠️ Failed to fund user wallet:",e)}return{address:c,publicKey:p}}e.s(["getUserBalance",()=>s,"getUserWallet",()=>n,"initializeUserWallet",()=>o])},96804,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(96250),n=e.i(59756),s=e.i(61916),i=e.i(74677),o=e.i(69741),l=e.i(16795),u=e.i(87718),d=e.i(95169),c=e.i(47587),p=e.i(66012),h=e.i(70101),f=e.i(26937),m=e.i(10372),w=e.i(93695);e.i(52474);var y=e.i(220),g=e.i(89171),v=e.i(57660),E=e.i(48295),x=e.i(9287),R=e.i(1379);async function A(t,{params:r}){try{let t=await (0,v.getServerSession)(E.authOptions);if(!t||!t.user)return g.NextResponse.json({success:!1,error:"Unauthorized"},{status:401});let{id:a}=await r,n=await x.prisma.quizAttempt.findFirst({where:{OR:[{id:a},{contractId:a}]},include:{quiz:!0}});if(!n)return g.NextResponse.json({success:!1,error:"Attempt not found"},{status:404});if(n.userId!==t.user.id)return g.NextResponse.json({success:!1,error:"Not your attempt"},{status:403});if("REFUNDED"===n.status)return g.NextResponse.json({success:!1,error:"Refund already claimed"},{status:400});await e.A(47085),console.log("💰 Processing refund claim..."),console.log("  Attempt ID:",n.id),console.log("  Quiz ID:",n.quiz.id),console.log("  Student:",t.user.id);let s=await (0,R.getUserWallet)(t.user.id);console.log("🔄 Syncing quiz contract...");let[i]=await s.query({ids:[n.quiz.contractId]}),o=await s.sync(i);console.log("  Quiz status:",o.status),console.log("  Teacher reveal deadline:",new Date(o.teacherRevealDeadline)),console.log("  Distribution deadline:",new Date(o.distributionDeadline)),console.log("🔄 Syncing attempt contract...");let[l]=await s.query({ids:[n.contractId]}),u=await s.sync(l),d=`
      export class QuizAttempt extends Contract {
        constructor(student, quizRef, answerCommitment, entryFee, quizTeacher) {
          if (!student) throw new Error('Student public key required')
          if (!quizRef) throw new Error('Quiz reference required')
          if (!answerCommitment) throw new Error('Answer commitment required')
          if (entryFee < 5000n) {
            throw new Error('Entry fee must be at least 5,000 satoshis')
          }

          super({
            _owners: [student],
            _satoshis: entryFee,
            student: student,
            quizRef: quizRef,
            quizTeacher: quizTeacher,
            answerCommitment: answerCommitment,
            revealedAnswers: null,
            nonce: null,
            score: null,
            passed: null,
            status: 'committed',
            submitTimestamp: Date.now(),
            revealTimestamp: null,
            version: '1.1.0'
          })
        }

        reveal(answers, nonce) {
          if (this.status !== 'committed') {
            throw new Error('Attempt already revealed or verified')
          }
          if (!Array.isArray(answers) || answers.length === 0) {
            throw new Error('Answers must be a non-empty array')
          }
          if (!nonce) {
            throw new Error('Nonce is required')
          }
          this.revealedAnswers = answers
          this.nonce = nonce
          this.status = 'revealed'
          this.revealTimestamp = Date.now()
        }

        verify(score, passed) {
          if (this.status !== 'revealed') {
            throw new Error('Must reveal answers first')
          }
          this.score = score
          this.passed = passed
          this.status = 'verified'
        }

        fail() {
          this.status = 'failed'
          this.passed = false
        }

        claimRefund(quiz) {
          // Validate quiz reference
          if (this.quizRef !== quiz._id) {
            throw new Error('Quiz reference mismatch')
          }

          if (this.status === 'refunded') {
            throw new Error('Refund already claimed')
          }

          // Scenario 1: Teacher didn't reveal before deadline
          const teacherMissedReveal = (
            quiz.status === 'active' &&
            Date.now() > quiz.teacherRevealDeadline
          )

          // Scenario 2: Teacher revealed but didn't distribute
          const teacherAbandonedAfterReveal = (
            quiz.status === 'revealed' &&
            Date.now() > quiz.distributionDeadline
          )

          // Scenario 3: Quiz explicitly marked abandoned
          const quizAbandoned = (quiz.status === 'abandoned')

          if (!teacherMissedReveal && !teacherAbandonedAfterReveal && !quizAbandoned) {
            throw new Error('Cannot claim refund: quiz not abandoned')
          }

          // Cash out entry fee to student
          this._satoshis = 546n
          this.status = 'refunded'
          this.refundedAt = Date.now()
        }

        getInfo() {
          return {
            attemptId: this._id,
            student: this.student,
            quizRef: this.quizRef,
            status: this.status,
            submitTimestamp: this.submitTimestamp,
            revealTimestamp: this.revealTimestamp,
            score: this.score,
            passed: this.passed,
            hasRevealed: this.status !== 'committed',
            revealedAnswers: this.revealedAnswers
          }
        }
      }
    `;console.log("📦 Deploying QuizAttempt module...");let c=await s.deploy(d);console.log("🔄 Calling claimRefund()...");let{tx:p}=await s.encodeCall({target:u,property:"claimRefund",args:[o],mod:c}),h=await s.broadcast(p);console.log("✅ Refund claimed! TX ID:",h),await x.prisma.quizAttempt.update({where:{id:n.id},data:{status:"REFUNDED"}});let{balance:f}=await s.getBalance();await x.prisma.user.update({where:{id:t.user.id},data:{walletBalance:f.toString()}});let m=Number(n.quiz.entryFee)-546;return g.NextResponse.json({success:!0,message:"Refund claimed successfully",refundedAmount:m,txId:h})}catch(e){return console.error("❌ Failed to claim refund:",e),g.NextResponse.json({success:!1,error:e instanceof Error?e.message:"Failed to claim refund"},{status:500})}}e.s(["POST",()=>A,"runtime",0,"nodejs"],62084);var b=e.i(62084);let q=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/attempts/[id]/refund/route",pathname:"/api/attempts/[id]/refund",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/packages/web/src/app/api/attempts/[id]/refund/route.ts",nextConfigOutput:"",userland:b}),{workAsyncStorage:C,workUnitAsyncStorage:S,serverHooks:_}=q;function T(){return(0,a.patchFetch)({workAsyncStorage:C,workUnitAsyncStorage:S})}async function N(e,t,a){q.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let g="/api/attempts/[id]/refund/route";g=g.replace(/\/index$/,"")||"/";let v=await q.prepare(e,t,{srcPage:g,multiZoneDraftMode:!1});if(!v)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:E,params:x,nextConfig:R,parsedUrl:A,isDraftMode:b,prerenderManifest:C,routerServerContext:S,isOnDemandRevalidate:_,revalidateOnlyGenerated:T,resolvedPathname:N,clientReferenceManifest:k,serverActionsManifest:z}=v,D=(0,o.normalizeAppPath)(g),O=!!(C.dynamicRoutes[D]||C.routes[N]),P=async()=>((null==S?void 0:S.render404)?await S.render404(e,t,A,!1):t.end("This page could not be found"),null);if(O&&!b){let e=!!C.routes[N],t=C.dynamicRoutes[D];if(t&&!1===t.fallback&&!e){if(R.experimental.adapterPath)return await P();throw new w.NoFallbackError}}let U=null;!O||q.isDev||b||(U="/index"===(U=N)?"/":U);let j=!0===q.isDev||!O,I=O&&!j;z&&k&&(0,i.setManifestsSingleton)({page:g,clientReferenceManifest:k,serverActionsManifest:z});let F=e.method||"GET",M=(0,s.getTracer)(),H=M.getActiveScopeSpan(),$={params:x,prerenderManifest:C,renderOpts:{experimental:{authInterrupts:!!R.experimental.authInterrupts},cacheComponents:!!R.cacheComponents,supportsDynamicResponse:j,incrementalCache:(0,n.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:R.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>q.onRequestError(e,t,a,n,S)},sharedContext:{buildId:E}},L=new l.NodeNextRequest(e),B=new l.NodeNextResponse(t),K=u.NextRequestAdapter.fromNodeNextRequest(L,(0,u.signalFromNodeResponse)(t));try{let i=async e=>q.handle(K,$).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=M.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${F} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t)}else e.updateName(`${F} ${g}`)}),o=!!(0,n.getRequestMeta)(e,"minimalMode"),l=async n=>{var s,l;let u=async({previousCacheEntry:r})=>{try{if(!o&&_&&T&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await i(n);e.fetchMetrics=$.renderOpts.fetchMetrics;let l=$.renderOpts.pendingWaitUntil;l&&a.waitUntil&&(a.waitUntil(l),l=void 0);let u=$.renderOpts.collectedTags;if(!O)return await (0,p.sendResponse)(L,B,s,$.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,h.toNodeOutgoingHttpHeaders)(s.headers);u&&(t[m.NEXT_CACHE_TAGS_HEADER]=u),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==$.renderOpts.collectedRevalidate&&!($.renderOpts.collectedRevalidate>=m.INFINITE_CACHE)&&$.renderOpts.collectedRevalidate,a=void 0===$.renderOpts.collectedExpire||$.renderOpts.collectedExpire>=m.INFINITE_CACHE?void 0:$.renderOpts.collectedExpire;return{value:{kind:y.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await q.onRequestError(e,t,{routerKind:"App Router",routePath:g,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:I,isOnDemandRevalidate:_})},!1,S),t}},d=await q.handleResponse({req:e,nextConfig:R,cacheKey:U,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:C,isRoutePPREnabled:!1,isOnDemandRevalidate:_,revalidateOnlyGenerated:T,responseGenerator:u,waitUntil:a.waitUntil,isMinimalMode:o});if(!O)return null;if((null==d||null==(s=d.value)?void 0:s.kind)!==y.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(l=d.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});o||t.setHeader("x-nextjs-cache",_?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),b&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let w=(0,h.fromNodeOutgoingHttpHeaders)(d.value.headers);return o&&O||w.delete(m.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||w.get("Cache-Control")||w.set("Cache-Control",(0,f.getCacheControlHeader)(d.cacheControl)),await (0,p.sendResponse)(L,B,new Response(d.value.body,{headers:w,status:d.value.status||200})),null};H?await l(H):await M.withPropagatedContext(e.headers,()=>M.trace(d.BaseServerSpan.handleRequest,{spanName:`${F} ${g}`,kind:s.SpanKind.SERVER,attributes:{"http.method":F,"http.target":e.url}},l))}catch(t){if(t instanceof w.NoFallbackError||await q.onRequestError(e,t,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:I,isOnDemandRevalidate:_})},!1,S),O)throw t;return await (0,p.sendResponse)(L,B,new Response(null,{status:500})),null}}e.s(["handler",()=>N,"patchFetch",()=>T,"routeModule",()=>q,"serverHooks",()=>_,"workAsyncStorage",()=>C,"workUnitAsyncStorage",()=>S],96804)},50767,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_9db9c1f1._.js","server/chunks/[root-of-the-server]__22490cf2._.js"].map(t=>e.l(t))).then(()=>t(4353)))},47085,e=>{e.v(t=>Promise.all(["server/chunks/[externals]_path_e30b8067._.js","server/chunks/node_modules_7cbdabb0._.js","server/chunks/[root-of-the-server]__72caa228._.js","server/chunks/node_modules_1002eb17._.js","server/chunks/[root-of-the-server]__aea4d4b8._.js"].map(t=>e.l(t))).then(()=>t(55027)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__1a8e8f0f._.js.map