export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Privacy Policy</h1>
      <p className="text-gray-500 mb-8">
        Last Updated: {new Date().toLocaleDateString()}
      </p>

      <div className="space-y-6 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            1. Overview
          </h2>
          <p>
            This application ("UTILS") is a personal project designed to provide
            developer productivity tools. We respect your privacy and aim to
            minimize data collection.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            2. Data We Do NOT Collect (PDF Tools)
          </h2>
          <p>
            The PDF Tools (JPG to PDF, PDF to JPG) operate{" "}
            <strong>entirely locally within your browser</strong>. When you
            select a file, it is processed by your device's CPU/Memory.
            <strong>
              Your files are never uploaded to our servers, never stored, and we
              never see their content.
            </strong>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            3. Third-Party Services (Authentication)
          </h2>
          <p>
            We use <strong>Google Firebase</strong> for authentication. When you
            sign in with Google:
          </p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>
              Firebase collects your email address, name, and profile picture to
              create your user profile.
            </li>
            <li>
              Firebase may use cookies or local storage to manage your session
              (keep you logged in).
            </li>
            <li>We do not share this data with any other third parties.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            4. Cloud Functions (JD Screener)
          </h2>
          <p>
            If you use the "JD Screener" tool, the text you submit is sent to a
            secure cloud function for analysis by an AI model. This data is
            transient (temporary) and is used solely to generate the response.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            5. Contact
          </h2>
          <p>
            If you have questions about this policy, please contact the
            developer via email at{" "}
            <a href="mailto:contact+utilsprivacy@vamsi-alluri.me">
              contact+utilsprivacy@vamsi-alluri.me
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
