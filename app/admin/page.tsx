import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ADMIN_EMAIL } from "@/lib/constants";

import { auth } from "../(auth)/auth";
import { AddUserForm } from "./add-user-form";

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <AdminPageContent />
    </Suspense>
  );
}

async function AdminPageContent() {
  const session = await auth();

  if (!session || session.user?.email !== ADMIN_EMAIL) {
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh w-full items-start justify-center bg-background px-4 py-12 md:items-center md:py-0">
      <section className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-border/40 bg-card px-6 py-10 shadow-lg">
        <div className="flex flex-col gap-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Admin only
          </p>
          <h1 className="font-semibold text-2xl">Add a new user</h1>
          <p className="text-muted-foreground text-sm">
            Enter the email address and password for the person you want to
            onboard. Accounts created here can sign in immediately.
          </p>
        </div>
        <AddUserForm />
      </section>
    </div>
  );
}
