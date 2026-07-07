import "dotenv/config";
import { createPrismaClient } from "../src/lib/create-prisma";
import { hashPassword } from "../src/lib/auth";

const email = (process.env.ADMIN_EMAIL ?? "matheuspoli@gomotors.local").trim();
const passwordRaw = process.env.ADMIN_PASSWORD?.trim();

if (!passwordRaw || passwordRaw.length < 8) {
  console.error(
    "Defina ADMIN_PASSWORD no .env (mínimo 8 caracteres).\n" +
      "Opcional: ADMIN_EMAIL para outro usuário."
  );
  process.exit(1);
}

const password = passwordRaw;

const prisma = createPrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });

  console.log(`Senha atualizada para ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
