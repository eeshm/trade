import request, { type SuperTest, type Test } from "supertest";
import type { Express } from "express";
import { createApp } from "../../../apps/api/src/index.ts";
import { initDb, shutdownDb } from "@repo/db";
import { initRedis, client as redisClient } from "@repo/redis";

let app: Express | null = null;
let initialized = false;

export const getApiClient = async (): Promise<SuperTest<Test>> => {
  if (!initialized) {
    await initDb();
    await initRedis();
    app = createApp();
    initialized = true;
  }

  if (!app) {
    throw new Error("Failed to initialize test application");
  }

  return request(app) as unknown as SuperTest<Test>;
};

export const shutdownApiClient = async (): Promise<void> => {
  if (!initialized) {
    return;
  }

  await shutdownDb().catch(() => undefined);

  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch (error) {
    console.warn("Failed to close Redis client after tests", error);
  }

  initialized = false;
  app = null;
};
