# Independent deployments

GariFile is maintained in the separate private Vjha151/garifile repository and the GariFile Coolify project. This repository serves only VijayJha.in. Vehicle pages and APIs return 404 and do not redirect to GariFile.

Each application must use a dedicated /app/data volume. The personal database contains only website content and administrator accounts. Customer records, document storage, sessions and deployments are independent. Preserve the pre-migration volume as an unmounted rollback archive.
