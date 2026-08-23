import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("document upload prefills metadata from the selected vehicle profile category",async()=>{
 const source=await readFile("src/components/VehicleManager.tsx","utf8");
 for(const field of[
  "first_party_policy_number","first_party_start_date","first_party_expiry_date",
  "third_party_policy_number","third_party_start_date","third_party_expiry_date",
  "puc_number","puc_issue_date","puc_expiry_date"
 ])assert.match(source,new RegExp(`documentDefaults[\\s\\S]*vehicle\\?\\.${field}`),field);
 assert.match(source,/setUpload\(category\)/);
 assert.match(source,/initialCategory=\{upload\}/);
 assert.match(source,/name="document_number" value=\{documentNumber\}/);
 assert.match(source,/name="issue_date" type="date" value=\{issueDate\}/);
 assert.match(source,/name="expiry_date" type="date" value=\{expiryDate\}/);
 assert.match(source,/category==="RC"[\s\S]*vehicle\?\.purchase_date/);
 assert.match(source,/\["Diesel","Petrol"\]\.includes\(vehicle\?\.fuel_type\)/);
 assert.match(source,/addYears\(issueDate,15\)/);
 assert.match(source,/Fuel Type<select value=\{vehicle\.fuel_type/);
 assert.doesNotMatch(source,/\/api\/private\/cars/);
});
