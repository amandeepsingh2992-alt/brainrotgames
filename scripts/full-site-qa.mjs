import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const errors = [];
const assert = (ok, message) => { if (!ok) errors.push(message); };
async function walk(dir) { const items = await fs.readdir(dir, { withFileTypes: true }); const out=[]; for (const item of items) { if (["node_modules", ".git", "qa-results"].includes(item.name)) continue; const file=path.join(dir,item.name); if(item.isDirectory()) out.push(...await walk(file)); else out.push(path.relative(root,file)); } return out; }
const files = await walk(root);
const htmlFiles = files.filter(f=>f.endsWith(".html"));
for (const file of files.filter(f=>/\.(js|mjs)$/.test(f))) { const check=spawnSync(process.execPath,["--check",file],{encoding:"utf8"}); assert(check.status===0,`Syntax error in ${file}: ${(check.stderr||check.stdout).trim()}`); }
for (const file of htmlFiles) { const html=await fs.readFile(file,"utf8"); assert(/<title[ >]/i.test(html),`${file} is missing a title`); assert(/name=["']description/i.test(html),`${file} is missing a description`); if(file!=="404.html") assert(/rel=["']canonical/i.test(html),`${file} is missing canonical`); assert(!/\0/.test(html),`${file} contains invalid NUL byte`); }
for (const file of ["index.html","pulse-tap.html","orbit-shift.html","letter-ladder.html","how-we-make-games.html"]) { const html=await fs.readFile(file,"utf8"); assert(!/noindex/i.test(html),`${file} must be indexable`); assert(!html.includes("gamepix.com"),`${file} must not depend on GamePix`); }
const routes=JSON.parse(await fs.readFile("_routes.json","utf8")); assert(routes.version===1,"Routing version must be 1");
const headers=await fs.readFile("_headers","utf8"); assert(headers.includes("X-Content-Type-Options: nosniff"),"nosniff header is missing"); assert(headers.includes("/games/*\n  X-Robots-Tag: noindex, follow"),"legacy catalogue must be noindex");
const sitemap=await fs.readFile("sitemap.xml","utf8"); for(const page of ["pulse-tap.html","orbit-shift.html","letter-ladder.html","how-we-make-games.html"]) assert(sitemap.includes(page),`Static sitemap missing ${page}`);
console.log(JSON.stringify({status:errors.length?"FAIL":"PASS",html:htmlFiles.length,js:files.filter(f=>/\.(js|mjs)$/.test(f)).length,errors},null,2)); if(errors.length)process.exitCode=1;
