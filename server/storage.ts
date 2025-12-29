import { DatabaseStorage } from "./DatabaseStorage";

let storage: DatabaseStorage;

export async function initStorage() {
  storage = new DatabaseStorage();
  console.log("✅ Using PostgreSQL database for data storage");
  return storage;
}

export { storage };
export type { WorkItemInput, WorkItem } from "./DatabaseStorage";
