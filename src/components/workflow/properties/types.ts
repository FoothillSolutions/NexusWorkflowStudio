import type { useForm } from "react-hook-form";

export type FormRegister = ReturnType<typeof useForm>["register"];
export type FormControl = ReturnType<typeof useForm>["control"];
export type FormSetValue = ReturnType<typeof useForm>["setValue"];
export type FormErrors = ReturnType<typeof useForm>["formState"]["errors"];

