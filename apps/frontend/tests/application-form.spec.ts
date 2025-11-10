import { test, expect } from "@playwright/test";

test.describe("Multi-step Application Form E2E", () => {
  const testApplicationFormId = "clq1m0z000000000000000000"; // Placeholder - replace with a valid ID from your test environment
  const testLeadId = "clq1m0z000000000000000001"; // Placeholder - replace with a valid ID from your test environment
  const testAccessCode = "1234"; // Placeholder - replace with a valid access code

  test("should successfully complete the multi-step application form", async ({ page }) => {
    await page.goto(`/client-form/${testApplicationFormId}/${testLeadId}`);

    // Step 0: Access Code / Login Page
    await expect(page.locator("h1")).toHaveText("Enter Access Code");
    await page.fill("input[type='text']", testAccessCode);
    await page.click("button:has-text('Access Form')");

    // Step 1: Personal Data
    await expect(page.locator("h2")).toHaveText("Personal Data");
    await page.fill("input[name='pesel']", "00000000000"); // Valid PESEL for testing
    await page.fill("input[name='firstName']", "Jan");
    await page.fill("input[name='lastName']", "Kowalski");
    await page.fill("input[name='phone']", "+48123456789");
    await page.fill("input[name='email']", "jan.kowalski@example.com");
    await page.fill("input[name='birthDate']", "1990-01-01");
    await page.fill("input[name='birthPlace']", "Warsaw");
    await page.selectOption("select[name='citizenship']", "PL");
    await page.fill("input[name='nationality']", "Polish");
    await page.fill("input[name='maidenName']", "Nowak");
    await page.selectOption("select[name='maritalStatus']", "SINGLE");
    await page.fill("input[name='mothersMaidenName']", "Kowalska");
    await page.check("input[name='taxResident']");
    await page.fill("input[name='numberOfChildren']", "0");
    await page.click("button:has-text('Next')");

    // Step 2: Identity Document
    await expect(page.locator("h2")).toHaveText("Identity Document");
    await page.selectOption("select[name='documentType']", "ID_CARD");
    await page.fill("input[name='documentNumber']", "ABC123456");
    await page.fill("input[name='issueDate']", "2020-01-01");
    await page.fill("input[name='expiryDate']", "2030-01-01");
    await page.selectOption("select[name='education']", "HIGHER");
    await page.click("button:has-text('Next')");

    // Step 3: Addresses
    await expect(page.locator("h2")).toHaveText("Addresses");
    await page.fill("input[name='streetAndNumber']", "Kwiatowa 1");
    await page.fill("input[name='zipCode']", "00-001");
    await page.fill("input[name='city']", "Warsaw");
    await page.fill("input[name='postOffice']", "Warsaw");
    await page.check("input[name='sameAsRegistered']"); // Assuming same as registered
    await page.click("button:has-text('Next')");

    // Step 4: Employment
    await expect(page.locator("h2")).toHaveText("Employment");
    await page.selectOption("select[name='incomeSource']", "EMPLOYMENT_CONTRACT");
    await page.fill("input[name='employmentSince']", "2015-01");
    await page.fill("input[name='occupation']", "Software Engineer");
    await page.fill("input[name='position']", "Senior Developer");
    await page.selectOption("select[name='employmentSector']", "PRIVATE");
    await page.fill("input[name='totalWorkExperienceYears']", "10");
    await page.fill("input[name='totalWorkExperienceMonths']", "0");
    await page.selectOption("select[name='employerType']", "CORPORATION");
    await page.fill("input[name='employerName']", "Example Corp");
    await page.fill("input[name='employerStreetAndNumber']", "Aleje Jerozolimskie 1");
    await page.fill("input[name='employerZipCode']", "00-001");
    await page.fill("input[name='employerCity']", "Warsaw");
    await page.fill("input[name='employerPostOffice']", "Warsaw");
    await page.fill("input[name='employerPhone']", "+48221112233");
    await page.click("button:has-text('Next')");

    // Step 5: Budget
    await expect(page.locator("h2")).toHaveText("Budget");
    await page.fill("input[name='mainIncome']", "5000");
    await page.fill("input[name='otherIncome']", "500");
    await page.fill("input[name='housingCosts']", "1500");
    await page.fill("input[name='otherLivingCosts']", "1000");
    await page.fill("input[name='loanInstallments']", "500");
    await page.fill("input[name='cardLimits']", "200");
    await page.fill("input[name='otherFinancialObligations']", "100");
    await page.click("button:has-text('Next')");

    // Step 6: Consents & Summary
    await expect(page.locator("h2")).toHaveText("Consents & Summary");
    // Assuming all required consents are visible and need to be checked
    await page.check("input[name='consent_marketing']");
    await page.check("input[name='consent_financial']");
    await page.check("input[name='consent_vehicle']");

    await page.click("button:has-text('Submit Application')");

    // Verify Thank You Page
    await expect(page.locator("h1")).toHaveText("Thank You!");
    await expect(page.locator("p")).toContainText("Your application has been successfully submitted.");
  });
});
