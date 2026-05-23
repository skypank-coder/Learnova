import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/error-handler";
import { requireRole } from "@/lib/rbac";
import { ValidationError } from "@/lib/errors";
import { initializeFirebase } from "@/lib/firebase-admin";
import admin from "firebase-admin";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(async (request) => {
  await requireRole(request, ["admin", "teacher", "student"]);

  const body = await request.json();
  const { passcode } = body;

  if (!passcode) {
    throw new ValidationError("Passcode is required");
  }

  initializeFirebase();

  const settingsDoc = await admin
    .firestore()
    .collection("attendance_settings")
    .doc("current_settings")
    .get();

  if (!settingsDoc.exists) {
    return NextResponse.json(
      { valid: false, error: "Attendance settings not configured on server" },
      { status: 404 }
    );
  }

  const settingsData = settingsDoc.data();
  const isValid = settingsData && settingsData.passcode === passcode;

  return NextResponse.json({ valid: isValid });
});
