import { projectId, publicAnonKey } from "../../../utils/supabase/info";

const supabaseUrl = `https://${projectId}.supabase.co`;

// Lazy-load the Supabase client to avoid build errors if the package isn't available yet
let _supabase: any = null;
let _clientPromise: Promise<any> | null = null;

function loadClient(): Promise<any> {
  // Cache before awaiting the import so concurrent callers share one auth client.
  if (!_clientPromise) {
    _clientPromise = import("@supabase/supabase-js")
      .then(({ createClient }) => {
        _supabase = createClient(supabaseUrl, publicAnonKey);
        return _supabase;
      })
      .catch((error) => {
        _clientPromise = null;
        throw error;
      });
  }
  return _clientPromise;
}

// Proxy that lazily initializes the Supabase client
export const supabase = new Proxy({} as any, {
  get(_target, prop) {
    if (prop === "then") return undefined; // prevent Promise-like behavior
    if (_supabase) return (_supabase as any)[prop];
    return new Proxy(() => {}, {
      get: (_t, innerProp) => {
        return (...args: any[]) =>
          loadClient().then((client: any) => client[prop][innerProp](...args));
      },
      apply: (_t, _thisArg, args) => {
        return loadClient().then((client: any) => client[prop](...args));
      },
    });
  },
});

export { loadClient };
