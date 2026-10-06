import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
const source = (await readFile(new URL("../src/lib/guest-checkout.ts", import.meta.url), "utf8"))
 .replace('import "server-only";', '')
 .replace('import { cookies } from "next/headers";', 'const cookies = async () => ({get: () => globalThis.guestTestToken ? {value: globalThis.guestTestToken} : undefined});');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {ownsOrder,guestTokenHash,newGuestToken} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
test("a guest download requires the private order token; email or session ID is insufficient", async () => {
 const token=newGuestToken();
 const order={id:"order",user_id:null,guest_token_hash:guestTokenHash(token)};
 assert.notEqual(token,order.guest_token_hash);
 assert.equal(await ownsOrder(order),false);
 globalThis.guestTestToken=newGuestToken();
 assert.equal(await ownsOrder(order),false);
 globalThis.guestTestToken=token;
 assert.equal(await ownsOrder(order),true);
 delete globalThis.guestTestToken;
 assert.equal(await ownsOrder({...order,user_id:"buyer"},"other"),false);
 assert.equal(await ownsOrder({...order,user_id:"buyer"},"buyer"),true);
});
