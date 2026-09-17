import { linkSchema, LinkSchemaType } from "@repo/data-ops/zod-schema/links";
import {getLink} from "@repo/data-ops/queries/links";
import { env } from "process";
import { LinkClickMessageType } from "@repo/data-ops/zod-schema/queue";
import moment from "moment";

async function getInfoFromKv(env: Env, id: string ) {
    const linkInfo = await env.CACHE.get(id)
    if (!linkInfo) return null;
        
     try{    
            const parsedLinkInfo = JSON.parse(linkInfo);
            return linkSchema.parse(parsedLinkInfo);
    } catch (error) {
        return null;
	}
}

const TTL_TIME = 60 * 60 * 24 ; // 7 days in 

async function saveLinkInfotoKv(env: Env, id: string, linkInfo: LinkSchemaType) { 
    
    
    try{
        await env.CACHE.put(id, JSON.stringify(linkInfo),
    
    
    {

        expirationTtl: TTL_TIME, // 7 days in seconds

    });

       
    } catch (error) {
        console.error(`Error saving link info to KV for id ${id}:`, error);
    }


}



export async function getRoutingDestinationFromKv(env: Env, id: string, ) {
    console.log("checking CACHE")
    const linkInfo = await getInfoFromKv(env, id);
    
    if (linkInfo) return linkInfo;

    const linkInfoFromDb = await getLink(id);
   
    if (!linkInfoFromDb) return null;

    await saveLinkInfotoKv(env, id, linkInfoFromDb);

    return linkInfoFromDb;

}


export function getDestinationForCountry(linkInfo: LinkSchemaType, countryCode?: string) {
	if (!countryCode) {
		return linkInfo.destinations.default;
	}

	// Check if the country code exists in destinations
	if (linkInfo.destinations[countryCode]) {
		return linkInfo.destinations[countryCode];
	}

	// Fallback to default
	return linkInfo.destinations.default;
}


export async function scheduleEvalWorkflow(env: Env, event: LinkClickMessageType) {
	const doId = env.EVALUATION_SCHEDULER.idFromName(`${event.data.id}:${event.data.destination}`);
	const stub = env.EVALUATION_SCHEDULER.get(doId);
	await stub.collectLinkClick(
		event.data.accountId,
		event.data.id,
		event.data.destination,
		event.data.country || "UNKNOWN"
	)
}

export async function captureLinkClickInBackground(env: Env, event: LinkClickMessageType) {
	await env.QUEUE.send(event)
	const doId = env.LINK_CLICK_TRACKER_OBJECT.idFromName(event.data.accountId);
	const stub = env.LINK_CLICK_TRACKER_OBJECT.get(doId);
	if (!event.data.latitude || !event.data.longitude || !event.data.country) return
	await stub.addClick(
		event.data.latitude,
		event.data.longitude,
		event.data.country,
		moment().valueOf()
	)
}
