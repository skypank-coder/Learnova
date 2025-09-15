import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { connectDb } from "@/lib/mongodb"; // your DB connection helper

export async function POST(req) {
  try {
    const formData = await req.formData();
    const name = formData.get("name");
    const rollNo = formData.get("rollNo");
    const email = formData.get("email");
    const file = formData.get("photo");

    if (!name || !rollNo || !email || !file) {
      return NextResponse.json(
        {
          success: false,
          error: "Name, rollNo, email, and photo are required",
        },
        { status: 400 }
      );
    }

    // Get DB
    const db = await connectDb();
    const users = db.collection("users");

    // Check if user already registered
    const existingUser = await users.findOne({ rollNo });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "User already registered with a photo" },
        { status: 409 } // conflict
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique filename
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `labels/${safeName}/1.jpg`;

    // Upload to Vercel Blob
    const blob = await put(fileName, buffer, {
      contentType: file.type || "image/jpeg",
      access: "public",
    });

    // Save user record in DB
    const user = {
      name,
      rollNo,
      email,
      image: blob.url, // only one photo allowed
    };
    await users.insertOne(user);

    return NextResponse.json({
      success: true,
      message: "User registered successfully",
      userData: user,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
