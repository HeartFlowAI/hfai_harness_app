# Public-source preparation

The publication copy includes reviewed project source, dependency lockfiles, required artwork, tests, documentation and third-party library notices. It excludes local settings, credentials, private conversations, captures, dependency directories and packaged application output.

A fresh initial Git commit is used for the publication copy so it does not inherit the original development repository’s account attribution or old local history. The original private repository is retained separately. The destination is created private; changing visibility and publishing build artifacts are separate steps.

Before making a repository public, confirm the intended code license and distribution rights for the character and brand assets. This project currently has no project-wide reuse license; third-party library licenses are retained under `src/vendor/`. A public repository does not itself grant reuse permission.

Automated pattern checks are useful but are not a guarantee that every kind of private data has been detected. Review future contributions and any issue attachments or release files with the same care.
