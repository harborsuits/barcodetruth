import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Terms() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Terms of Use</CardTitle>
            <p className="text-sm text-muted-foreground">
              <strong>Effective Date:</strong> October 2025
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <p>
              Welcome to BarcodeTruth ("the Service"). By accessing or using this site, you agree to these Terms of Use.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">1. Use of the Service</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You may use BarcodeTruth for <strong>personal, educational, and non-commercial</strong> purposes.</li>
              <li>You agree not to copy, modify, redistribute, sell, or reverse-engineer any portion of this platform or its data.</li>
              <li>You must be at least 13 years old to create an account.</li>
              <li>You are responsible for your account activity and maintaining the confidentiality of your login credentials.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">2. Intellectual Property</h2>
            <p>
              All content, logos, data architecture, text, and source code are © 2025 BarcodeTruth™ by Ben Dickinson.
              All rights reserved.
              You may not reproduce or reuse content except as allowed under fair use with proper attribution.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">3. Community Conduct</h2>
            <p>Users agree to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Contribute ratings or feedback in good faith.</li>
              <li>Avoid spam, harassment, or misinformation.</li>
              <li>Respect others' opinions and evidence submissions.</li>
            </ul>
            <p>
              We reserve the right to remove content or suspend accounts that violate these terms.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">4. Disclaimers</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>BarcodeTruth provides information from <strong>publicly available sources</strong> and <strong>community input</strong>.</li>
              <li>We make no guarantees of completeness or absolute accuracy.</li>
              <li>Content is for <strong>informational and educational purposes only</strong>, not investment, legal, or consumer advice.</li>
            </ul>

            <h2 className="text-xl font-semibold mt-6 mb-3">5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, BarcodeTruth and its contributors are <strong>not liable</strong> for any direct, indirect, incidental, or consequential damages resulting from use or inability to use the Service.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">6. Termination</h2>
            <p>
              We may suspend or terminate access if you violate these Terms or misuse the platform.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">7. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Maine, USA.
            </p>

            <h2 className="text-xl font-semibold mt-6 mb-3">8. Contact</h2>
            <p>
              Questions or concerns?<br />
              📧 <a href="mailto:support@barcodetruth.app" className="text-primary hover:underline">support@barcodetruth.app</a>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
