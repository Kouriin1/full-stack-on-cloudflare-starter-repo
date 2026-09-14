import { Hono } from "hono";
import { getLink } from "@repo/data-ops/queries/links";
import { cloudflareInfoSchema } from "@repo/data-ops/zod-schema/links";
import { getDestinationForCountry, getRoutingDestinationFromKv } from "./helpers/rauting-ops";
import { LinkClickMessageType } from "@repo/data-ops/zod-schema/queue";


export const App = new Hono<{Bindings: Env}>();




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
            country: destination,
            destination: destination,
            accountId: LinkInfo.accountId,
            latitude: headers.latitude,
            longitude: headers.longitude,
            timestamp: new Date().toISOString(),
        }

    }
    
    c.executionCtx.waitUntil(
        c.env.QUEUE.send(queueMessage)
    );

    return c.redirect(destination);

})