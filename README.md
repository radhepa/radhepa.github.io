# Radhe Patel · portfolio

Static personal site: Home, Projects (with case studies), Lab notebook (blog + RSS), Awards, Courses, About.
Comes with a built-in editor. Nothing to install besides Node.js.

## Edit the site

Double-click **`Edit site.cmd`**. It opens the editor at http://localhost:4321/admin/ in your browser.
(Or run `node serve.mjs` and open that address.)

- **Profile & home**: name, photo, résumé, contact links, home page text.
- **About**: bio, experience, teams, tools.
- **Projects**: add, reorder, delete; give any project its own case-study page.
- **Lab notebook**: write entries. New ones start as drafts.
- **Awards / Courses**: sections of timelines, cards or lists.

Press **Save changes** (or Ctrl+S). The preview at http://localhost:4321/ updates right away.
Nothing goes online until you press **Publish**. Close the black window to stop the editor.

Long text uses simple formatting marks (Markdown); the editor's Help tab lists them.

## Where things live

| What | Where |
|---|---|
| All your content | `content/*.json` (the editor writes these) |
| Uploaded images and files | `assets/uploads/` |
| Colors and layout | `assets/css/site.css` |
| Page templates | `build.mjs` |
| The finished site | `docs/` (rebuilt on every save; don't edit by hand) |

## Publish (GitHub Pages + Namecheap), one-time setup

1. Push this folder to a GitHub repo.
2. Repo **Settings → Pages**: Source "Deploy from a branch", branch `main`, folder `/docs`.
3. In the editor, put your domain under **Profile & home → Your domain** and save.
4. In Namecheap, **Domain List → Manage → Advanced DNS**, delete the parking records and add:

   | Type | Host | Value |
   |---|---|---|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | `radhepa.github.io.` |

5. Back in **Settings → Pages**, enter the domain under "Custom domain", wait for the DNS check, then tick **Enforce HTTPS**.

After that, the editor's **Publish** tab sends your changes live with one button.
