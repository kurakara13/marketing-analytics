import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar</CardTitle>
        <CardDescription>
          Buat akun baru untuk mulai menggunakan Marketing Analytics.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
      <CardFooter className="text-muted-foreground text-sm">
        Sudah punya akun?{" "}
        <Link
          href="/login"
          className="text-foreground ml-1 font-medium underline-offset-4 hover:underline"
        >
          Masuk
        </Link>
      </CardFooter>
    </Card>
  );
}
