import { Hono } from "hono";
import { getLink } from "@repo/data-ops/queries/links";
import { cloudflareInfoSchema } from "@repo/data-ops/zod-schema/links";
import { getDestinationForCountry, getRoutingDestinationFromKv, captureLinkClickInBackground } from "./helpers/rauting-ops";
import { LinkClickMessageType } from "@repo/data-ops/zod-schema/queue";


export const App = new Hono<{Bindings: Env}>();


App.get('/click-socket', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
	if (!upgradeHeader || upgradeHeader !== 'websocket') {
		return c.text('Expected Upgrade: websocket', 426);
	}

const accountId = c.req.header('account-id')

if (!accountId) return  c.text('No Headers', 404);
  const doId = c.env.LINK_CLICK_TRACKER_OBJECT.idFromName(accountId);
	const stub = c.env.LINK_CLICK_TRACKER_OBJECT.get(doId);
  return await stub.fetch(c.req.raw)
})



App.get('/:id', async (c) => {

    const id = c.req.param('id');

    const LinkInfo = await getRoutingDestinationFromKv(c.env, id);

    c.env.CACHE

    if(!LinkInfo) {
        return c.json({error: "Link not found"}, 404);
    }

    const cfheader = cloudflareInfoSchema.safeParse(c.req.raw.cf);

    if (!cfheader.success) {
        return c.text(  `Invalid Cloudflare header: ${cfheader.error.message}`, 400);
    }

    const headers = cfheader.data;
    const destination = getDestinationForCountry(LinkInfo, headers.country);

    const queueMessage: LinkClickMessageType = {
        "type": "LINK_CLICK",
        data: {
            id: id,
            country: headers.country,
            destination: destination,
            accountId: LinkInfo.accountId,
            latitude: headers.latitude,
            longitude: headers.longitude,
            timestamp: new Date().toISOString(),
        }

    }
    
    c.executionCtx.waitUntil(
       captureLinkClickInBackground(c.env, queueMessage)
    );

    return c.redirect(destination);

})