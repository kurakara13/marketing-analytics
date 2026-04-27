import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Masuk</CardTitle>
        <CardDescription>
          Masukkan email dan password Anda untuk melanjutkan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
      <CardFooter className="text-muted-foreground text-sm">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="text-foreground ml-1 font-medium underline-offset-4 hover:underline"
        >
          Daftar
        </Link>
      </CardFooter>
    </Card>
  );
}
