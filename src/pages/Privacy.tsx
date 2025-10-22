import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header showSettings={true} showBack={true} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">
              <strong>Effective Date:</strong> October 2025 | <strong>Last Updated:</strong> October 2025
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p>
              BarcodeTruth ("we," "our," or "us") values your privacy. This Privacy Policy explains what information we collect, how we use it, and the limited circumstances under which we share it.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">1. Information We Collect</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">a. Information you provide</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account information:</strong> email address or name when you sign up or sign in through authentication.</li>
              <li><strong>Community ratings:</strong> when you rate a brand or provide feedback, we store your responses, optional context notes, and timestamps.</li>
              <li><strong>Payment information:</strong> if you purchase a subscription or feature, Stripe securely processes your payment. We never store credit-card numbers.</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">b. Information collected automatically</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Device & browser data</strong> (e.g., IP address, user-agent) for basic analytics, security, and abuse prevention.</li>
              <li><strong>Cookies / local storage:</strong> used only for session management and preferences.</li>
              <li><strong>Usage logs:</strong> anonymous performance and error logs to improve reliability.</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">c. No sensitive or unnecessary data</h3>
            <p>
              We do <strong>not</strong> collect government IDs, GPS locations, biometric data, or personal contact lists.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">2. How We Use Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and improve BarcodeTruth's features.</li>
              <li>To secure accounts, prevent abuse, and maintain integrity of community ratings.</li>
              <li>To analyze aggregated, anonymized trends (never individual profiles).</li>
              <li>To communicate essential updates (e.g., policy changes, account verification).</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">3. Sharing and Disclosure</h2>
            <p>
              We do <strong>not sell or rent</strong> your personal data.
              We may share limited information only with:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Service providers</strong> (e.g., cloud hosting, payment processors, AI services) that process data under strict confidentiality agreements.</li>
              <li><strong>Legal authorities</strong> if required by law or to protect users and system integrity.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">4. Data Storage & Retention</h2>
            <p>
              Data is hosted securely on cloud infrastructure (PostgreSQL, U.S.-based).
              We retain minimal user data for as long as your account is active or until you request deletion.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">5. Your Rights</h2>
            <p>You may:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access or delete your account data via your profile page.</li>
              <li>Contact us at <a href="mailto:support@barcodetruth.app" className="text-primary hover:underline">support@barcodetruth.app</a> for removal requests or questions.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">6. Children's Privacy</h2>
            <p>
              BarcodeTruth is not directed at children under 13, and we do not knowingly collect data from them.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">7. Updates</h2>
            <p>
              We may update this Privacy Policy periodically. Continued use constitutes acceptance of any changes.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
