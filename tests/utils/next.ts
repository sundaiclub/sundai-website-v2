type FulfilledPromise<T> = Promise<T> & {
  status: 'fulfilled';
  value: T;
};

export function resolvedParams<T>(value: T): Promise<T> {
  const promise = Promise.resolve(value) as FulfilledPromise<T>;
  promise.status = 'fulfilled';
  promise.value = value;
  return promise;
}
