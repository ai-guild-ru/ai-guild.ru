import crypto from 'crypto'
import type { Prisma, TelegramAccount, User } from '@prisma/client'
import { builder } from '../../../../builder'
import { TelegramAuthDataInput } from '../inputs'
import { createToken } from '../../../User/helpers/auth'
import { AuthPayload } from '../../../User/inputs'

interface TelegramAuthData {
  id: number
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  photo_url?: string | null
  auth_date?: number | null
  hash?: string | null
}

function checkTelegramAuth(data: TelegramAuthData): boolean {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN env is empty')
  }

  const { hash, ...rest } = data
  if (!hash) {
    return false
  }

  const dataCheckString = Object.keys(rest)
    .filter((key) => rest[key as keyof typeof rest] !== null)
    .sort()
    .map((key) => `${key}=${rest[key as keyof typeof rest]}`)
    .join('\n')

  const secret = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest()
  const hmac = crypto
    .createHmac('sha256', new Uint8Array(secret))
    .update(dataCheckString)
    .digest('hex')

  return hmac === hash
}

builder.mutationField('authViaTelegram', (t) =>
  t.field({
    type: AuthPayload,
    args: {
      tgAuthData: t.arg({ type: TelegramAuthDataInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { tgAuthData } = args
      const { prisma, currentUser } = ctx

      const externalKey = tgAuthData.id.toString()

      const isValid = checkTelegramAuth(tgAuthData)

      if (!isValid) {
        return {
          success: false,
          message: 'Token is not valid',
          token: null,
        }
      }

      let user: User | undefined
      let tgAccount: TelegramAccount | null | undefined
      let token: string | undefined

      const tgAccountResponse = await prisma.telegramAccount.findUnique({
        where: {
          externalKey,
        },
        include: {
          User: true,
        },
      })

      if (tgAccountResponse) {
        user = tgAccountResponse.User
        tgAccount = tgAccountResponse
        token = await createToken(user, ctx)
      } else {
        const { auth_date, first_name, last_name, photo_url, username } =
          tgAuthData

        const tgCreateData: Prisma.TelegramAccountCreateWithoutUserInput = {
          externalKey,
          auth_date: auth_date ? new Date(auth_date * 1000) : undefined,
          first_name,
          last_name,
          photo_url,
          username,
        }

        if (currentUser) {
          user = currentUser

          const newTgAccount = await prisma.telegramAccount.create({
            data: {
              ...tgCreateData,
              User: {
                connect: {
                  id: currentUser.id,
                },
              },
            },
            include: {
              User: true,
            },
          })

          if (newTgAccount) {
            token = await createToken(currentUser, ctx)
            tgAccount = newTgAccount
          }
        } else {
          const newUser = await prisma.user.create({
            data: {
              TelegramAccount: {
                create: tgCreateData,
              },
            },
            include: {
              TelegramAccount: true,
            },
          })

          if (newUser) {
            token = await createToken(newUser, ctx)
            user = newUser
            tgAccount = newUser.TelegramAccount
          }
        }
      }

      if (!tgAccount) {
        return {
          success: false,
          message: 'Telegram account was not created',
          token: null,
        }
      }

      if (!user) {
        return {
          success: false,
          message: 'User was not created',
          token: null,
        }
      }

      if (!token) {
        return {
          success: false,
          message: 'Token was not created',
          token: null,
        }
      }

      return {
        success: true,
        message: null,
        token,
      }
    },
  }),
)
