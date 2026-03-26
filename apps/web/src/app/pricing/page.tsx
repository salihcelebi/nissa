"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Elements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { createCheckoutSession } from "@/lib/stripe";
import { useUser } from "@/lib/auth/supabase-client";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { PLAN_INFO } from "@/lib/stripe-config";

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

// Child component that uses the useStripe hook
function PricingContent() {
  const [loading, setLoading] = useState<string | null>(null);
  const { user } = useUser();
  const stripe = useStripe();

  const tiers = [
    {
      name: PLAN_INFO.STARTER.name,
      price: PLAN_INFO.STARTER.price,
      description: PLAN_INFO.STARTER.description,
      features: [
        "Aylık 10.000 yapay zekâ isteği",
        "En fazla 3 ekip üyesi",
        "Temel sohbet botu özelleştirme",
        "Standart yanıt süresi",
        "E-posta desteği",
        "1 sohbet botu yayını",
      ],
      cta: "Hemen abone ol",
      ctaDescription: "Hemen başlayın",
      popular: false,
      priceId: PLAN_INFO.STARTER.priceId,
      creditLimit: PLAN_INFO.STARTER.creditLimit,
    },
    {
      name: PLAN_INFO.PROFESSIONAL.name,
      price: PLAN_INFO.PROFESSIONAL.price,
      description: PLAN_INFO.PROFESSIONAL.description,
      features: [
        "Aylık 50.000 yapay zekâ isteği",
        "En fazla 10 ekip üyesi",
        "Gelişmiş sohbet botu özelleştirme",
        "Öncelikli yanıt süresi",
        "Öncelikli destek",
        "Özel alan adı",
        "API erişimi",
        "5 sohbet botu yayını",
      ],
      cta: "Hemen abone ol",
      ctaDescription: "İşletmeler için en popüler plan",
      popular: true,
      priceId: PLAN_INFO.PROFESSIONAL.priceId,
      creditLimit: PLAN_INFO.PROFESSIONAL.creditLimit,
    },
    {
      name: PLAN_INFO.ENTERPRISE.name,
      price: PLAN_INFO.ENTERPRISE.price,
      description: PLAN_INFO.ENTERPRISE.description,
      features: [
        "Sınırsız yapay zekâ isteği",
        "Sınırsız ekip üyesi",
        "Tam özelleştirme yetenekleri",
        "Özel yapay zekâ modeli ince ayarı",
        "Özel müşteri desteği",
        "Özel alan adları",
        "Gelişmiş API erişimi",
        "SSO kimlik doğrulama",
        "Denetim kayıtları",
        "SLA güvenceleri",
        "Sınırsız sohbet botu yayını",
      ],
      cta: "Hemen abone ol",
      ctaDescription: "Büyük kuruluşlar için",
      popular: false,
      priceId: PLAN_INFO.ENTERPRISE.priceId,
      creditLimit: PLAN_INFO.ENTERPRISE.creditLimit,
    },
  ];

  const handleSubscribe = async (priceId: string) => {
    if (!user) {
      toast.error("Bir plana abone olmak için lütfen giriş yapın");
      return;
    }

    if (!stripe) {
      toast.error("Stripe yüklenemedi. Lütfen tekrar deneyin.");
      return;
    }

    try {
      setLoading(priceId);

      // Create checkout session
      const { url } = await createCheckoutSession({
        priceId,
        userId: user.id,
        customerEmail: user.email,
      });

      // Redirect to Stripe Checkout (redirectToCheckout removed in @stripe/stripe-js v3+)
      if (!url) throw new Error("No checkout URL returned");
      window.location.href = url;
    } catch (error) {
      console.error("Failed to create checkout session:", error);
      toast.error("Abonelik işlemi başarısız oldu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-24">
      <div className="mb-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">
          Kurumsal Yapay Zekâ Sohbet Botu Fiyatlandırması
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
          İş ihtiyaçlarınıza en uygun planı seçin. Büyüdükçe yapay zekâ
          yeteneklerinizi ölçeklendirin.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            className={`flex flex-col ${tier.popular ? "border-primary relative shadow-lg" : "border-border"}`}
          >
            {tier.popular && (
              <Badge className="bg-primary hover:bg-primary absolute -top-2.5 right-6">
                En Popüler
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="text-xl">{tier.name}</CardTitle>
              <CardDescription className="min-h-[50px]">
                {tier.description}
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">${tier.price}</span>
                <span className="text-muted-foreground ml-2">/ay</span>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-3">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start"
                  >
                    <Check className="mr-2 h-5 w-5 shrink-0 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch pt-6">
              <Button
                variant={tier.popular ? "default" : "outline"}
                className="w-full"
                size="lg"
                onClick={() => handleSubscribe(tier.priceId)}
                disabled={loading === tier.priceId}
              >
                {loading === tier.priceId ? "İşleniyor..." : tier.cta}
              </Button>
              <p className="text-muted-foreground mt-3 text-center text-xs">
                {tier.ctaDescription}
              </p>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-20 text-center">
        <h2 className="mb-4 text-2xl font-bold">Özel bir çözüme mi ihtiyacınız var?</h2>
        <p className="text-muted-foreground mx-auto mb-6 max-w-2xl">
          Kurumsal çözümlerimiz, yapay zekâ sohbet botu gereksinimlerinize ve
          entegrasyon ihtiyaçlarınıza özel olarak uyarlanabilir.
        </p>
        <Button
          variant="outline"
          size="lg"
          onClick={() => (window.location.href = "/contact")}
        >
          Satış ekibiyle iletişime geç
        </Button>
      </div>

      <div className="mt-24 border-t pt-12">
        <h3 className="mb-6 text-center text-xl font-semibold">
          Sık Sorulan Sorular
        </h3>
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          <div>
            <h4 className="mb-2 font-medium">Yapay zekâ isteği olarak ne sayılır?</h4>
            <p className="text-muted-foreground text-sm">
              Yapay zekâ modelimize gönderilen her mesaj bir istek olarak sayılır.
              Yapay zekâdan gelen yanıtlar da istek sayısına dahildir.
            </p>
          </div>
          <div>
            <h4 className="mb-2 font-medium">
              Planımı ay ortasında yükseltebilir miyim?
            </h4>
            <p className="text-muted-foreground text-sm">
              Evet, planınızı istediğiniz zaman yükseltebilirsiniz. Yeni kredi
              limitiniz hemen uygulanır ve fark tutarı orantılı olarak ücretlendirilir.
            </p>
          </div>
          <div>
            <h4 className="mb-2 font-medium">Kullanılmayan krediler devreder mi?</h4>
            <p className="text-muted-foreground text-sm">
              Hayır, yapay zekâ istek kredileri her fatura döneminin başında
              sıfırlanır ve sonraki aya devretmez.
            </p>
          </div>
          <div>
            <h4 className="mb-2 font-medium">
              Kâr amacı gütmeyen kuruluşlara indirim sunuyor musunuz?
            </h4>
            <p className="text-muted-foreground text-sm">
              Evet, kâr amacı gütmeyen kuruluşlar için özel fiyatlandırma
              sunuyoruz. Detaylar için satış ekibimizle iletişime geçin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main component wrapped with Elements provider
export default function PricingPage() {
  return (
    <Elements stripe={stripePromise}>
      <Navbar />
      <PricingContent />
    </Elements>
  );
}
