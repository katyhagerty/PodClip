import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Headphones } from "lucide-react";
import { SiGithub } from "react-icons/si";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsPending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", values);
      const user = await res.json();
      queryClient.setQueryData(["/api/user"], user);
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-4">
            <Headphones className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to PodClip</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in to access your saved clips
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* OAuth options */}
          <a href="/api/login" data-testid="button-signin-replit">
            <Button variant="outline" className="w-full gap-2" type="button">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.5c2.07 0 3.75 1.68 3.75 3.75S14.07 12 12 12 8.25 10.32 8.25 8.25 9.93 4.5 12 4.5zm0 15c-2.625 0-5.1-1.05-6.9-2.925C5.775 14.7 8.775 13.5 12 13.5s6.225 1.2 6.9 3.075C17.1 18.45 14.625 19.5 12 19.5z"/>
              </svg>
              Continue with Replit
            </Button>
          </a>

          <a href="/api/login" data-testid="button-signin-github">
            <Button variant="outline" className="w-full gap-2" type="button">
              <SiGithub className="w-4 h-4" />
              Continue with GitHub
            </Button>
          </a>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or sign in with username</span>
            </div>
          </div>

          {/* Local username/password form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="username" {...field} data-testid="input-username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit">
                {isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex justify-center border-t p-6">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary hover:underline font-medium" data-testid="link-register">
              Create one
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
