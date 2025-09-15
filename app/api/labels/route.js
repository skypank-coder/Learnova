import { NextResponse } from "next/server";
import {connectDb} from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await connectDb();
    const users = db.collection("users");

    const allUsers = await users
      .find({}, { projection: { _id: 0 } }) // exclude _id
      .toArray();

    return NextResponse.json(allUsers, { status: 200 });
  } catch (err) {
    console.error("❌ Error fetching labels:", err);
    return NextResponse.json(
      { error: "Failed to fetch labels" },
      { status: 500 }
    );
  }
}
