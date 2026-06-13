import Stripe from "stripe";
import { getStripe } from "./get-stripe";
import { SERVICE_UNAVAILABLE } from "@/lib/env/messages";

export { getStripe } from "./get-stripe";

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripe();
    if (!client) {
      throw new Error(SERVICE_UNAVAILABLE.stripe);
    }

    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
