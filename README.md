# PricePocket — MongoDB Atlas setup

The website is ready for **Netlify + MongoDB Atlas free tiers**. The website itself never contains your Atlas password. Netlify keeps it private and talks to Atlas on the website's behalf.

## Your only one-time setup

1. In MongoDB Atlas, create a free cluster and copy its **Node.js connection string**. Replace `<password>` in it with the database user's password.
2. Create a free Netlify account, choose **Add new project → Import an existing project**, and select a GitHub repository containing this folder.
3. In the Netlify project’s **Project configuration → Environment variables**, add these three values:

   - `MONGODB_URI` — your complete Atlas connection string.
   - `AUTH_SECRET` — any long private phrase, for example 30+ random letters and numbers.
   - `STAFF_USERS` — staff login details in this exact format:
     `{"owner@shop.com":"your-password","staff@shop.com":"their-password"}`
4. Click **Deploy**. The first signed-in visit automatically creates the `pricepocket` database, the `items` collection, an index, and three example products. Edit or delete those examples in the app.

Employees use the Netlify website link and their own email/password from `STAFF_USERS`. Price data is stored in Atlas; it is refreshed for everyone every 10 seconds and immediately after any change.

## Important Atlas setting

In Atlas **Network Access**, allow the Netlify server to connect. For the simple free setup, this usually means allowing `0.0.0.0/0`; it is still protected because your database password is only stored in Netlify environment variables, never in this website. Use a strong unique database password.

Do not put `MONGODB_URI`, `AUTH_SECRET`, or staff passwords into `app.js` or any file uploaded publicly.
