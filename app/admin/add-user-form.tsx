"use client";

import { useActionState, useEffect, useState } from "react";

import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";

import { type AddUserActionState, addUser } from "./actions";

const initialState: AddUserActionState = {
  status: "idle",
};

export function AddUserForm() {
  const [email, setEmail] = useState("");
  const [state, formAction] = useActionState<AddUserActionState, FormData>(
    addUser,
    initialState
  );

  useEffect(() => {
    if (state.status === "success") {
      toast({
        type: "success",
        description: "User was created successfully.",
      });
    } else if (state.status === "user_exists") {
      toast({
        type: "error",
        description: "That email is already registered.",
      });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: "Provide a valid email and a password with 6+ characters.",
      });
    } else if (state.status === "failed") {
      toast({
        type: "error",
        description: "We couldn't create the user. Try again.",
      });
    } else if (state.status === "forbidden") {
      toast({
        type: "error",
        description: "You are not allowed to perform this action.",
      });
    }
  }, [state.status]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <AuthForm action={handleSubmit} defaultEmail={email}>
      <SubmitButton
        disableOnSuccess={false}
        isSuccessful={state.status === "success"}
      >
        Add user
      </SubmitButton>
    </AuthForm>
  );
}


