"use client";

import {z} from "zod";
import {loginSchema} from "@/features/auth/client.schema";
import {useActionState} from "react";
import {authAction} from "@/features/auth/action";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {AUTH_INTENT} from "@/features/auth/constants";
import Link from "next/link";
import Image from "next/image";

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(authAction, {});

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {email: "", password: ""},
  });

  return (
    <div className="min-h-svh grid w-full lg:grid-cols-2 bg-background text-foreground">
      {/* Left side: Branding Showcase with Unsplash Background */}
      <div className="relative hidden lg:flex flex-col justify-between border-r border-border p-10 overflow-hidden">
        {/* Unsplash Background Image */}
        <Image
          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200"
          alt="Abstract geometric landscape"
          fill
          priority
          className="object-cover opacity-15 dark:opacity-20"
        />

        <div className="relative z-10 flex items-center gap-2 font-medium text-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 40 40" fill="none">
            <g id="logomark">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10 0C15.5228 0 20 4.47715 20 10V0H30C35.5228 0 40 4.47715 40 10C40 15.5228 35.5228 20 30 20C35.5228 20 40 24.4772 40 30C40 32.7423 38.8961 35.2268 37.1085 37.0334L37.0711 37.0711L37.0379 37.1041C35.2309 38.8943 32.7446 40 30 40C27.2741 40 24.8029 38.9093 22.999 37.1405C22.9756 37.1175 22.9522 37.0943 22.9289 37.0711C22.907 37.0492 22.8852 37.0272 22.8635 37.0051C21.0924 35.2009 20 32.728 20 30C20 35.5228 15.5228 40 10 40C4.47715 40 0 35.5228 0 30V20H10C4.47715 20 0 15.5228 0 10C0 4.47715 4.47715 0 10 0ZM18 10C18 14.4183 14.4183 18 10 18V2C14.4183 2 18 5.58172 18 10ZM38 30C38 25.5817 34.4183 22 30 22C25.5817 22 22 25.5817 22 30H38ZM2 22V30C2 34.4183 5.58172 38 10 38C14.4183 38 18 34.4183 18 30V22H2ZM22 18V2H30C34.4183 2 38 5.58172 38 10C38 14.4183 34.4183 18 30 18H22Z"
                fill="#5417D7"
              />
            </g>
          </svg>
          Square Base
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <blockquote className="space-y-2">
            <p className="text-xl font-medium leading-snug text-foreground">
              &ldquo;Square Base has completely transformed how our team manages workflows and scales our infrastructure
              effortlessly.&rdquo;
            </p>
            <footer className="text-sm text-muted-foreground">
              — Alex Rivera, Lead Architect
            </footer>
          </blockquote>

          <div className="grid grid-cols-3 gap-4 border-t border-border/80 pt-6 text-center sm:text-left">
            <div>
              <p className="text-2xl font-bold">99.9%</p>
              <p className="text-xs text-muted-foreground">Uptime SLA</p>
            </div>
            <div>
              <p className="text-2xl font-bold">10x</p>
              <p className="text-xs text-muted-foreground">Faster Deploy</p>
            </div>
            <div>
              <p className="text-2xl font-bold">24/7</p>
              <p className="text-xs text-muted-foreground">Dedicated Support</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Square Base Inc. All rights reserved.
        </p>
      </div>

      {/* Right side: Login Form Container */}
      <div className="flex items-center justify-center p-4 sm:p-8 md:p-12">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo header (visible when left side panel is hidden) */}
          <div className="flex items-center gap-2 lg:hidden mb-5 justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 40 40" fill="none">
              <g id="logomark">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M10 0C15.5228 0 20 4.47715 20 10V0H30C35.5228 0 40 4.47715 40 10C40 15.5228 35.5228 20 30 20C35.5228 20 40 24.4772 40 30C40 32.7423 38.8961 35.2268 37.1085 37.0334L37.0711 37.0711L37.0379 37.1041C35.2309 38.8943 32.7446 40 30 40C27.2741 40 24.8029 38.9093 22.999 37.1405C22.9756 37.1175 22.9522 37.0943 22.9289 37.0711C22.907 37.0492 22.8852 37.0272 22.8635 37.0051C21.0924 35.2009 20 32.728 20 30C20 35.5228 15.5228 40 10 40C4.47715 40 0 35.5228 0 30V20H10C4.47715 20 0 15.5228 0 10C0 4.47715 4.47715 0 10 0ZM18 10C18 14.4183 14.4183 18 10 18V2C14.4183 2 18 5.58172 18 10ZM38 30C38 25.5817 34.4183 22 30 22C25.5817 22 22 25.5817 22 30H38ZM2 22V30C2 34.4183 5.58172 38 10 38C14.4183 38 18 34.4183 18 30V22H2ZM22 18V2H30C34.4183 2 38 5.58172 38 10C38 14.4183 34.4183 18 30 18H22Z"
                  fill="#5417D7"
                />
              </g>
            </svg>
            <span className="font-semibold text-base">Square Base</span>
          </div>

          <Card className="border border-border bg-card rounded-xl">
            <CardHeader className="space-y-1 text-left">
              <CardTitle className="text-xl font-semibold tracking-tight">
                Welcome back
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Sign in to your Square Base account
              </CardDescription>
            </CardHeader>

            <CardContent>
              {state.error && (
                <div
                  className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive mb-4">
                  {state.error}
                </div>
              )}

              <form
                action={formAction}
                noValidate
                onSubmitCapture={async (e) => {
                  const ok = await form.trigger(undefined, {shouldFocus: true});
                  if (!ok) e.preventDefault();
                }}
              >
                <FieldGroup>
                  {/* Email Field */}
                  <Controller
                    name="email"
                    control={form.control}
                    render={({field, fieldState}) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="login-email" className="text-sm font-medium">
                          Email
                        </FieldLabel>
                        <Input
                          {...field}
                          id="login-email"
                          type="email"
                          placeholder="m@example.com"
                          autoComplete="email"
                          aria-invalid={fieldState.invalid}
                          className="w-full"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]}/>
                        )}
                      </Field>
                    )}
                  />

                  {/* Password Field */}
                  <Controller
                    name="password"
                    control={form.control}
                    render={({field, fieldState}) => (
                      <Field data-invalid={fieldState.invalid}>
                        <div className="flex items-center justify-between">
                          <FieldLabel htmlFor="login-password" className="text-sm font-medium">
                            Password
                          </FieldLabel>
                          <a
                            href="#"
                            className="text-xs text-muted-foreground hover:underline underline-offset-4"
                          >
                            Forgot password?
                          </a>
                        </div>
                        <Input
                          {...field}
                          id="login-password"
                          type="password"
                          placeholder="••••••••"
                          autoComplete="current-password"
                          aria-invalid={fieldState.invalid}
                          className="w-full"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]}/>
                        )}
                      </Field>
                    )}
                  />
                </FieldGroup>

                <Button
                  type="submit"
                  name="intent"
                  value={AUTH_INTENT.LOGIN}
                  disabled={isPending}
                  className="w-full font-medium mt-4"
                >
                  {isPending ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border"/>
                </div>
                <span className="relative bg-card px-2 text-xs uppercase text-muted-foreground font-medium">
                  Or continue with
                </span>
              </div>

              {/* Social Login Buttons using `render` */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  nativeButton={false}
                  render={
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
                      className="inline-flex items-center justify-center w-full"
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      Google
                    </a>
                  }
                />

                <Button
                  variant="outline"
                  className="w-full"
                  nativeButton={false}
                  render={
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL}/auth/github`}
                      className="inline-flex items-center justify-center w-full"
                    >
                      <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                      GitHub
                    </a>
                  }
                />
              </div>

              {/* Sign up redirection */}
              <div className="pt-4 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  className="font-medium text-foreground hover:underline underline-offset-4"
                >
                  Sign up
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}