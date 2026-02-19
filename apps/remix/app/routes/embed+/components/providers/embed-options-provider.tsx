import React, { createContext, useContext, useEffect, useState } from 'react';

import { getEmbedOptions } from '../../utils/get-embed-options';

type EmbedOptionsContextValue = {
  isSystem: boolean;
};

const EmbedOptionsContext = createContext<EmbedOptionsContextValue>({
  isSystem: false,
});

export const useEmbedOptions = () => useContext(EmbedOptionsContext);

type EmbedOptionsProviderProps = {
  children: React.ReactNode;
};

export const EmbedOptionsProvider = ({ children }: EmbedOptionsProviderProps) => {
  const [isSystem, setIsSystem] = useState(false);

  useEffect(() => {
    const options = getEmbedOptions();
    console.log('options', options);
    setIsSystem(options.isSystem === true);
  }, []);

  return (
    <EmbedOptionsContext.Provider value={{ isSystem }}>{children}</EmbedOptionsContext.Provider>
  );
};
