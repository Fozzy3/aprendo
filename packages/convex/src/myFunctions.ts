import { v } from "convex/values";
import {
  query,
  mutation,
  internalAction,
} from "./_generated/server";
import { api } from "./_generated/api";

// Write your Convex functions in any file inside this directory (`convex`).
// See https://docs.convex.dev/functions for more.

// Public query used by the web app integration smoke test.
export const myQuery = query({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Query implementation.
  handler: async (_ctx, args) => {
    //// Read the database as many times as you need here.
    //// See https://docs.convex.dev/database/reading-data.
    // const documents = await ctx.db.query("tableName").collect();
    // return documents;

    return {
      echoedNumber: args.first,
      echoedText: args.second,
      message: `Convex responded with ${args.first} and "${args.second}".`,
    };
  },
});

// Public mutation used by the web app integration smoke test.
export const myMutation = mutation({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Mutation implementation.
  handler: async (_ctx, args) => {
    return {
      echoedNumber: args.first,
      echoedText: args.second,
      message: `Convex mutation received ${args.first} and "${args.second}".`,
    };
  },
});

// You can fetch data from and send data to third-party APIs via an action:
export const myAction = internalAction({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Action implementation.
  handler: async (ctx, args) => {
    //// Use the browser-like `fetch` API to send HTTP requests.
    //// See https://docs.convex.dev/functions/actions#calling-third-party-apis-and-using-npm-packages.
    // const response = await fetch("https://api.thirdpartyservice.com");
    // const data = await response.json();

    //// Query data by running Convex queries.
    const data = await ctx.runQuery(api.myFunctions.myQuery, {
      first: args.first,
      second: args.second,
    });
    console.log(data);

    //// Write data by running Convex mutations.
    await ctx.runMutation(api.myFunctions.myMutation, {
      first: args.first,
      second: args.second,
    });
  },
});
