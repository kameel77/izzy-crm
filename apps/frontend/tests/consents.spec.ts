import { expect, test } from "@playwright/test";

const APPLICATION_FORM_ID = "cjld2cjxh0000qzrmn831i7rn";
const LEAD_ID = "cjld2cjxh0001qzrmn831i7rn";
const ACCESS_CODE = "1234";
const ACCESS_CODE_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";

const consentTemplatesResponse = {
  data: [
    {
      id: "tpl_marketing",
      consentType: "MARKETING",
      formType: "financing_application",
      title: "Zgoda marketingowa",
      content: "Wyrażam zgodę na kontakt marketingowy.",
      helpText: "Wymagana do przedstawienia ofert.",
      version: 2,
      isActive: true,
      isRequired: true,
      tags: [],
    },
    {
      id: "tpl_vehicle",
      consentType: "VEHICLE_PARTNERS",
      formType: "financing_application",
      title: "Zgoda na kontakt partnerów",
      content: "Wyrażam zgodę na kontakt dealerów.",
      helpText: null,
      version: 1,
      isActive: true,
      isRequired: false,
      tags: [],
    },
  ],
};

const seedClientStore = async (page) => {
  const snapshot = [
    {
      applicationFormId: APPLICATION_FORM_ID,
      leadId: LEAD_ID,
      accessCodeHash: ACCESS_CODE_HASH,
      consents: {},
      updatedAt: new Date().toISOString(),
    },
  ];

  await page.addInitScript(([key, data]) => {
    window.sessionStorage.setItem(key, JSON.stringify(data));
  }, ["client-form:consents", snapshot]);
};

test("client consents flow stores state and handles submit", async ({ page, context }) => {
  await context.route("**/api/consent-templates?**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(consentTemplatesResponse),
    });
  });

  let capturedPayload: unknown = null;
  await context.route("**/api/consent-records", async (route) => {
    capturedPayload = await route.request().postDataJSON();
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ processed: 2 }),
    });
  });

  await seedClientStore(page);
  await page.goto(
    `/client-form/consents?applicationFormId=${APPLICATION_FORM_ID}&leadId=${LEAD_ID}&hash=${ACCESS_CODE_HASH}`,
  );
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "Zgody RODO" })).toBeVisible();
  await expect(page.getByText("Zgoda marketingowa")).toBeVisible();

  await page.getByLabel("Zgoda na kontakt partnerów").check();
  await page.getByRole("button", { name: "Zapisz zgody" }).click();

  await expect(page.getByText("Zgody zostały zapisane")).toBeVisible();
  expect(capturedPayload).toMatchObject({
    leadId: LEAD_ID,
    applicationFormId: APPLICATION_FORM_ID,
    consents: expect.arrayContaining([
      expect.objectContaining({ consentTemplateId: "tpl_marketing", version: 2, consentGiven: true }),
      expect.objectContaining({ consentTemplateId: "tpl_vehicle", consentGiven: true }),
    ]),
  });
});

test("shows modal when submit returns 409 and triggers refetch", async ({ page, context }) => {
  await context.route("**/api/consent-templates?**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(consentTemplatesResponse),
    });
  });

  let served409 = false;
  await context.route("**/api/consent-records", (route) => {
    if (!served409) {
      served409 = true;
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ code: "TEMPLATE_OUTDATED" }),
      });
      return;
    }
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ processed: 2 }),
    });
  });

  await seedClientStore(page);
  await page.goto(
    `/client-form/consents?applicationFormId=${APPLICATION_FORM_ID}&leadId=${LEAD_ID}&hash=${ACCESS_CODE_HASH}`,
  );
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Zapisz zgody" }).click();
  await expect(page.getByText("Wersja formularza nieaktualna")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("button", { name: "Zapisz zgody" }).click();
  await expect(page.getByText("Zgody zostały zapisane")).toBeVisible();
});
