# TRADIE Legal Documents - GitHub Pages Setup

This folder contains the Privacy Policy and Terms of Service for the TRADIE app.

## 📁 Files Created

- `index.html` - Landing page with links to both documents
- `privacy-policy.html` - Privacy Policy
- `terms-of-service.html` - Terms of Service

## 🚀 How to Host on GitHub Pages

### Option 1: Using This Repository (Recommended)

1. **Push this folder to GitHub:**
   ```bash
   cd /Users/pvosloo/Documents/GitHub/DIY/Tradie\ -\ 2026-02-07/mobile
   git add docs/
   git commit -m "Add privacy policy and terms of service"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your GitHub repository
   - Click **Settings** → **Pages**
   - Under **Source**, select **Deploy from a branch**
   - Under **Branch**, select **main** and **/docs** folder
   - Click **Save**

3. **Get your URLs:**
   - After a few minutes, your site will be live at:
   - `https://[your-username].github.io/[repo-name]/`
   - Privacy Policy: `https://[your-username].github.io/[repo-name]/privacy-policy.html`
   - Terms of Service: `https://[your-username].github.io/[repo-name]/terms-of-service.html`

### Option 2: Create a New Repository

1. **Create a new repository on GitHub:**
   - Repository name: `tradie-legal` (or any name you prefer)
   - Make it public
   - Don't initialize with README

2. **Upload these files:**
   - Use GitHub's web interface to upload all files in the `docs/` folder
   - Or use git commands:
     ```bash
     cd docs/
     git init
     git add .
     git commit -m "Initial commit: Legal documents"
     git branch -M main
     git remote add origin https://github.com/[your-username]/tradie-legal.git
     git push -u origin main
     ```

3. **Enable GitHub Pages:**
   - Go to repository **Settings** → **Pages**
   - Under **Source**, select **Deploy from a branch**
   - Under **Branch**, select **main** and **/ (root)** folder
   - Click **Save**

4. **Your URLs will be:**
   - `https://[your-username].github.io/tradie-legal/privacy-policy.html`
   - `https://[your-username].github.io/tradie-legal/terms-of-service.html`

## 📝 What to Put in App Store Connect

Once your GitHub Pages site is live, use these URLs in App Store Connect:

**Privacy Policy URL:**
```
https://[your-username].github.io/[repo-name]/privacy-policy.html
```

**Terms of Service URL (if requested):**
```
https://[your-username].github.io/[repo-name]/terms-of-service.html
```

## ✏️ Customizing the Documents

### Important: Update Contact Information

Before publishing, update the following in **BOTH** files:

1. **Email Address:**
   - Find: `support@tradie.app`
   - Replace with your actual support email

2. **Company Name (optional):**
   - Find: `TRADIE`
   - Add your company name if you have one

3. **Location:**
   - Find: `United Kingdom`
   - Update if you're in a different country

### Files to Update:
- `privacy-policy.html` (bottom section)
- `terms-of-service.html` (bottom section)
- `index.html` (footer)

## ⚖️ Legal Disclaimer

**IMPORTANT:** These documents are templates and should be reviewed by a qualified attorney before use. While they're comprehensive and based on best practices, they may not cover all legal requirements specific to your jurisdiction or business model.

Consider having a lawyer review if:
- You operate in multiple countries
- You handle sensitive data
- You have specific regulatory requirements
- You want additional protections

## 🔄 Updating the Documents

To update the documents after they're published:

1. Edit the HTML files locally
2. Commit and push the changes to GitHub
3. GitHub Pages will automatically update (takes 1-2 minutes)
4. The URLs remain the same - no need to update App Store Connect

## 📱 Testing

Before submitting to App Store:

1. Visit the URLs in your mobile browser
2. Check that pages load correctly on iPhone
3. Verify all links work
4. Ensure contact information is correct

## ✅ Checklist

- [ ] Files created in `docs/` folder
- [ ] Contact email updated in all files
- [ ] Company/location information updated
- [ ] Pushed to GitHub
- [ ] GitHub Pages enabled
- [ ] URLs tested on mobile
- [ ] URLs added to App Store Connect
- [ ] (Optional) Legal review completed

## 🆘 Need Help?

Common issues:

**GitHub Pages not working:**
- Wait 5-10 minutes after enabling (first deployment takes time)
- Check repository is public (Settings → General)
- Verify branch and folder are correct in Pages settings

**404 Error:**
- Check file names are exact: `privacy-policy.html` (not `privacy.html`)
- Ensure files are in the correct folder (`docs/` if using Option 1)

**Files not updating:**
- Clear browser cache
- Wait a few minutes for GitHub Pages to rebuild
- Check commit was pushed successfully

## 📧 Support

If you need help setting this up, feel free to ask!
