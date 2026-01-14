export const buildOfferLink = (params: { baseUrl: string; discountPln: number }) => {
  const payload = `offerDiscount=${params.discountPln}`;
  const base64 = Buffer.from(payload, "utf-8").toString("base64");
  const base64url = base64.replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const url = new URL(params.baseUrl);
  url.searchParams.append("offer", base64url);

  return {
    payload,
    base64url,
    finalUrl: url.toString(),
  };
};
