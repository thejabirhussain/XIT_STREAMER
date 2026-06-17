Here is the complete step-by-step developer console setup guide to configure the authorization credentials for **YouTube (Google)**, **Facebook (Meta)**, and **Instagram (Meta)**.

---

### Phase 1: Setting up YouTube (Google Developer Console)

To stream to YouTube and aggregate live chat, we use the Google Cloud Console.

#### Step 1: Create a Project & Enable the API
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your Google Workspace or Gmail account.
3. Click the Project dropdown in the top-left and select **"New Project"**. Name it `XIT Streamer` and click **Create**.
4. Go to **APIs & Services > Library**.
5. Search for **"YouTube Data API v3"**, click on it, and click **"Enable"**.

#### Step 2: Configure the OAuth Consent Screen
1. Go to **APIs & Services > OAuth Consent Screen**.
2. Select **User Type**:
   * Choose **Internal** if you are testing inside an enterprise organization.
   * Choose **External** if you are launching to public creators. Click **Create**.
3. Fill out the **App Information**:
   * App Name: `XIT Streamer`
   * User support email: `your-email@domain.com`
   * Developer contact information: `your-email@domain.com`
4. Click **Save and Continue**.

#### Step 3: Add Scopes
1. Click **Add or Remove Scopes**.
2. In the manually add scope field, paste:
   * `https://www.googleapis.com/auth/youtube.force-ssl` (Required to schedule broadcasts, retrieve stream keys, and write/delete chat messages).
   * `https://www.googleapis.com/auth/youtube.readonly` (Optional: for read-only metrics).
3. Click **Add to Table** and then **Update**. Click **Save and Continue**.
4. Under **Test Users**, add your own Gmail address so you can authorize the app while it is in "Testing" mode.

#### Step 4: Create Credentials
1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials** at the top and select **OAuth Client ID**.
3. Set **Application Type** to **Web Application**.
4. Configure URLs:
   * **Authorized JavaScript origins:** `http://localhost:3000` (and production domains later).
   * **Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/youtube` (where Google will send the auth code).
5. Click **Create**.
6. Copy and save your **Client ID** and **Client Secret**.

---

### Phase 2: Setting up Facebook & Instagram (Meta for Developers)

Both Facebook and Instagram are managed from the same Meta Developer App dashboard, but they use different APIs.

#### Step 1: Create a Meta App
1. Go to the [Meta for Developers Portal](https://developers.facebook.com/).
2. Log in with a Facebook account that is an administrator of your Business Manager.
3. Click **My Apps > Create App**.
4. Select **Business** as the app type (This is required to access advanced features like Instagram Graph API and Facebook Live APIs). Click **Next**.
5. Set App Display Name: `XIT Streamer`. Click **Create App**.

#### Step 2: Add Products
Inside your new Meta App dashboard, add the following products from the "Add Products to Your App" list:
1. **Facebook Login for Business:** Click **Set Up**.
2. **Instagram Graph API:** Click **Set Up**.

#### Step 3: Configure Redirect URIs
1. In the left sidebar, navigate to **Facebook Login > Settings**.
2. Scroll to **Client OAuth Settings**.
3. In the **Valid OAuth Redirect URIs** field, enter:
   * `http://localhost:3000/api/auth/callback/facebook`
   * `http://localhost:3000/api/auth/callback/instagram`
4. Click **Save Changes**.

#### Step 4: Configure App Settings
1. Go to **Settings > Basic** in the left sidebar.
2. Note your **App ID** and **App Secret** (click show and type your password to reveal).
3. Fill out the Privacy Policy URL and Terms of Service URL (use placeholder pages on localhost for now, e.g., `http://localhost:3000/privacy`).
4. Select a category (e.g., **Business and Finance** or **Utility**).

#### Step 5: Required Permissions (Permissions List)
To run live streaming and comments-to-buy, your app will require authorization scopes from the user. You will configure these in your code when calling the login dialog:

* **For Facebook Live Broadcasting:**
  * `publish_video` (Allows publishing live videos to timelines/pages).
  * `live_video` (Allows creating RTMP live video endpoints).
  * `pages_show_list` (Allows showing the list of Pages the user manages).
  * `pages_read_engagement` and `pages_manage_posts` (Allows reading comments and posting replies on Facebook Pages).
* **For Instagram Live & DM Automation (Comment-to-Buy):**
  * `instagram_basic` (Allows retrieving IG account info).
  * `instagram_manage_comments` (Allows reading comments on Instagram Live stream media objects).
  * `instagram_manage_messages` (Critical: allows sending direct messages with checkout links to users who commented).
  * `pages_manage_metadata` (Allows configuring webhooks to receive instant notifications when comments are made).

#### Step 6: Meta App Review & Testing (Crucial for launch)
* **Local Sandbox Mode:** By default, your app is in "Development Mode." You can log in and test all permissions immediately, but **only using accounts added as Roles (Administrators, Developers, or Testers) on the App Dashboard**.
* **App Review Submission:** Before the general public can connect their accounts, you must submit your app to **App Review**. 
  * Meta will require you to submit a screencast video showing how you use the permissions (e.g., demonstrating the comment-to-buy DM trigger flow) and verify your Business Entity (via tax documents or business registration).