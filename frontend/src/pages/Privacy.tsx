import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <article className="container prose-tl max-w-3xl py-14">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy notice</h1>
      <p className="mt-3">This describes the default behavior of the software. The operator of a given deployment is responsible for its configuration and for any additional terms; check with them if in doubt.</p>

      <h2>Faces are personal data</h2>
      <p>Analysis detects faces in your video and extracts face frames, which are images of identifiable people and may be biometric data under some laws. Only upload media you have the right to process, and consider the privacy of the people shown. Face detection here is used to locate regions for scoring; it does not identify who a person is.</p>

      <h2>What we store</h2>
      <ul>
        <li>Your account details (email, display name, settings) and a hashed password.</li>
        <li>Uploaded videos and extracted frame images, only until the retention period ends or you delete them.</li>
        <li>Analysis results: scores, explanations and metadata such as file name, size and a SHA-256 hash.</li>
        <li>Security and audit records (for example sign-ins and deletions) that include IP addresses.</li>
      </ul>

      <h2>Retention and deletion</h2>
      <ul>
        <li>Media is deleted automatically after your retention setting (a server default applies if you do not set one).</li>
        <li>You can delete a single video and its frames, a whole analysis, all of your media, or your account from the app at any time.</li>
        <li>You can export your account data and results as JSON from Settings.</li>
      </ul>

      <h2>Model training</h2>
      <p>Your uploads are <strong>not</strong> used to train or improve models by default. There is an optional setting, off by default, that you can turn on or off in Settings.</p>

      <h2>Third parties</h2>
      <p>None by default. Analysis runs on the deployment's own infrastructure. Optional features that involve a third party, such as Google sign-in or an email provider, are active only if the operator configures them.</p>

      <h2>Cookies</h2>
      <p>We use strictly necessary cookies for sign-in and request protection (session, refresh and CSRF cookies). We do not store session tokens in browser storage.</p>

      <p className="mt-10">See also the <Link to="/docs">documentation</Link>.</p>
    </article>
  )
}
