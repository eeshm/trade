process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.TZ = process.env.TZ ?? "UTC";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection during tests:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception during tests:", error);
});
