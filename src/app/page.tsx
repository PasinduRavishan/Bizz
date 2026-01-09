import Link from "next/link";
import { WalletConnect } from "@/components/wallet/WalletConnect";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">B</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bizz</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Decentralized Quiz Platform</p>
            </div>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Earn Bitcoin by Taking Quizzes
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Teachers create incentivized quizzes, students earn real Bitcoin for correct answers.
            All powered by smart contracts on the blockchain.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Teacher Card */}
          <Card hover>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🎓</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">For Teachers</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300">
                Create quizzes with prize pools to incentivize learning. Earn from entry fees while students compete for rewards.
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Set prize pools & entry fees</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Keep 98% of entry fees</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Secure smart contracts</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Transparent verification</span>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <Link href="/teacher/create">
                  <Button className="w-full" size="lg">Create Quiz</Button>
                </Link>
                <Link href="/teacher/dashboard">
                  <Button className="w-full" variant="outline" size="lg">View My Quizzes</Button>
                </Link>
              </div>
            </CardBody>
          </Card>

          {/* Student Card */}
          <Card hover>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📚</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">For Students</h3>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300">
                Take quizzes and earn Bitcoin for getting answers right. Compete with others for prize pools.
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Browse available quizzes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Pay entry fee to attempt</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Win Bitcoin for passing</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">Fair commit-reveal system</span>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <Link href="/student/browse">
                  <Button className="w-full" size="lg" variant="primary">Browse Quizzes</Button>
                </Link>
                <Link href="/student/my-attempts">
                  <Button className="w-full" variant="outline" size="lg">My Attempts</Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Stats Section */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">🔗</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Bitcoin</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Blockchain Powered</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">🔐</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Secure</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Smart Contracts</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">✨</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Fair</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Commit-Reveal</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Built on Bitcoin Computer • Testnet</p>
        </div>
      </footer>
    </div>
  );
}
